import { StatusBar } from "expo-status-bar";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { EmptyState } from "./components/EmptyState";
import { ExplorePage } from "./pages/ExplorePage";
import { MessagesPage } from "./pages/MessagesPage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SavedPage } from "./pages/SavedPage";
import { seedListings } from "./data";
import { auth, db, firebaseConfigured } from "./firebase";
import { createListing, markListingAsSold } from "./listings";
import { convertToUsd, Currency, fetchUsdToLkrRate, formatPrice } from "./currency";
import {
  loadLocalUserSettings,
  parseUserSettings,
  saveLocalUserSettings,
  UserSettings,
} from "./settings";
import { AppTheme, ThemeColors, themeColors } from "./theme";
import {
  ensureUserProfile,
  saveListingPhoto,
  saveProfilePhoto,
  saveUserSettings,
} from "./userData";
import { Listing, Tab } from "./types";

// ─── Category list (for the sell modal picker) ───────────────────────────────
const SELL_CATEGORIES = [
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Sports",
  "Stationery",
  "Other",
];

const CONDITION_OPTIONS = ["Like New", "Good condition", "Fair", "For Parts"];

export default function App() {
  const [tab, setTab] = useState<Tab>("Explore");
  const [items, setItems] = useState<Listing[]>(db ? [] : seedListings);
  const [queryText, setQueryText] = useState("");
  const [category, setCategory] = useState("All items");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "price-asc" | "price-desc">("newest");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(loadLocalUserSettings);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState("");
  const colors = themeColors[settings.theme];

  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) return;
    const handleUser = (nextUser: User | null) => {
      setUser(nextUser);
    };
    let unsubscribe: () => void = () => undefined;
    setPersistence(firebaseAuth, browserLocalPersistence)
      .then(() => {
        unsubscribe = onAuthStateChanged(firebaseAuth, handleUser);
        return getRedirectResult(firebaseAuth);
      })
      .then((result) => {
        if (result?.user) handleUser(result.user);
      })
      .catch((error) =>
        setAuthError(
          error instanceof Error
            ? error.message
            : "Google sign-in could not be completed.",
        ),
      );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileReady(false);
      setProfilePhotoURL(null);
      setSettings(loadLocalUserSettings());
      return;
    }
    const firestore = db;
    if (!firestore) {
      setProfilePhotoURL(user.photoURL);
      setProfileReady(true);
      return;
    }

    let active = true;
    let unsubscribe: () => void = () => {};
    setProfileReady(false);
    ensureUserProfile(user)
      .then(() => {
        if (!active) return;
        unsubscribe = onSnapshot(
          doc(firestore, "users", user.uid),
          (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            setProfilePhotoURL(
              typeof data.photoURL === "string" ? data.photoURL : user.photoURL,
            );
            const loadedSettings = parseUserSettings(data.settings);
            setSettings(loadedSettings);
            saveLocalUserSettings(loadedSettings);
            setProfileReady(true);
            setAuthError("");
          },
          (error) => {
            if (!active) return;
            setAuthError(
              error instanceof Error
                ? error.message
                : "Could not load your saved profile.",
            );
          },
        );
      })
      .catch((error) => {
        if (active) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "Could not create your saved profile.",
          );
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !db || settings.currency !== "LKR") return;
    const rateIsFresh =
      settings.exchangeRateUpdatedAt !== undefined &&
      Date.now() - settings.exchangeRateUpdatedAt < 24 * 60 * 60 * 1000;
    if (rateIsFresh) return;

    let active = true;
    fetchUsdToLkrRate()
      .then(async (exchangeRate) => {
        if (!active) return;
        const rateSettings = {
          exchangeRate,
          exchangeRateUpdatedAt: Date.now(),
        };
        await saveUserSettings(user.uid, rateSettings);
        if (active) {
          setSettings((current) => ({ ...current, ...rateSettings }));
          setExchangeRateError("");
        }
      })
      .catch((error) => {
        if (active) {
          setExchangeRateError(
            error instanceof Error
              ? error.message
              : "Could not refresh the USD/LKR exchange rate.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [settings.currency, settings.exchangeRateUpdatedAt, user]);

  useEffect(() => {
    if (!db) return;
    const listingsQuery = query(
      collection(db, "listings"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      listingsQuery,
      (snapshot) =>
        setItems(
          snapshot.docs.map(
            (entry) => ({ id: entry.id, ...entry.data() }) as Listing,
          ),
        ),
      (error) =>
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not load listings from Firebase.",
        ),
    );
  }, []);

  const filteredItems = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const result = items.filter((item) => {
      const matchesCategory =
        category === "All items" || item.category === category;
      if (!matchesCategory) return false;

      const matchesPrice =
        item.price >= minPrice && (maxPrice === null || item.price <= maxPrice);
      if (!matchesPrice) return false;

      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.campus && item.campus.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });

    return result.sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      return 0;
    });
  }, [category, items, maxPrice, minPrice, queryText, sortBy]);

  const resetFilters = () => {
    setQueryText("");
    setCategory("All items");
    setMinPrice(0);
    setMaxPrice(null);
    setSortBy("newest");
  };
  const myListings = useMemo(
    () => (user ? items.filter((item) => item.sellerId === user.uid) : []),
    [items, user],
  );
  const selectedItem = useMemo(
    () =>
      selected
        ? items.find((item) => item.id === selected.id) || selected
        : null,
    [items, selected],
  );
  const toggleSaved = (id: string) =>
    setSavedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const changeTheme = async (theme: AppTheme) => {
    try {
      if (user && db) await saveUserSettings(user.uid, { theme });
      setSettings((current) => {
        const updated = { ...current, theme };
        saveLocalUserSettings(updated);
        return updated;
      });
    } catch (error) {
      Alert.alert(
        "Could not save setting",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const changeCurrency = async (currency: Currency) => {
    setExchangeRateError("");
    const changes: Partial<UserSettings> = { currency };
    if (currency === "LKR") {
      try {
        const exchangeRate = await fetchUsdToLkrRate();
        Object.assign(changes, {
          exchangeRate,
          exchangeRateUpdatedAt: Date.now(),
        });
      } catch (error) {
        if (!settings.exchangeRate) {
          setExchangeRateError(
            error instanceof Error
              ? error.message
              : "Could not load the USD/LKR exchange rate.",
          );
          Alert.alert(
            "Currency unavailable",
            "LKR cannot be selected until an exchange rate is available.",
          );
          return;
        }
        changes.exchangeRate = settings.exchangeRate;
        setExchangeRateError(
          "Could not refresh the rate. Using your previously cached exchange rate.",
        );
      }
    }
    try {
      if (user && db) await saveUserSettings(user.uid, changes);
      setSettings((current) => {
        const updated = { ...current, ...changes };
        saveLocalUserSettings(updated);
        return updated;
      });
    } catch (error) {
      Alert.alert(
        "Could not save setting",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const uploadPhoto = async () => {
    if (!user) return;
    setPhotoBusy(true);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error("Allow photo library access to choose a profile photo.");
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        throw new Error("The selected image could not be read. Please choose another image.");
      }
      const imageSize = asset.fileSize ?? Math.ceil((asset.base64.length * 3) / 4);
      if (imageSize >= 5 * 1024 * 1024) {
        throw new Error("Choose an image smaller than 5 MB.");
      }
      const photoURL = await saveProfilePhoto(
        user.uid,
        asset.base64,
        asset.mimeType || "image/jpeg",
      );
      await updateProfile(user, { photoURL });
      setProfilePhotoURL(photoURL);
    } catch (error) {
      Alert.alert(
        "Could not update profile photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };
  const signInWithGoogle = async () => {
    if (!auth) {
      // In demo mode without Firebase credentials, allow signing in as a demo student
      const demoUser = {
        uid: "demo-student-1",
        displayName: "Jordan K.",
        email: "jordan@campus.edu",
        photoURL: null,
      } as unknown as User;
      setUser(demoUser);
      setProfileReady(true);
      setAuthOpen(false);
      return;
    }
    setAuthError("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      if (Platform.OS === "web") {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        setUser(result.user);
        setAuthOpen(false);
      } else {
        await signInAnonymously(auth);
        setAuthOpen(false);
      }
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "Google sign-in failed.";
      if (
        Platform.OS === "web" &&
        /popup|cancelled-popup-request/i.test(code)
      ) {
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }
      setAuthError(code);
      Alert.alert("Google sign-in failed", code);
    }
  };

  /**
   * publish — called from SellModal with optional base64 image data
   */
  const publish = async (
    title: string,
    price: string,
    listingCategory: string,
    description: string,
    condition: string,
    imageBase64?: string,
    imageMimeType?: string,
  ) => {
    if (!user) {
      setSellOpen(false);
      setAuthOpen(true);
      return;
    }
    const enteredPrice = Number(price);
    if (!title.trim() || !Number.isFinite(enteredPrice) || enteredPrice <= 0) {
      Alert.alert("Check listing details", "Enter a title and a price greater than zero.");
      return;
    }
    let priceInUsd: number;
    try {
      priceInUsd = convertToUsd(enteredPrice, settings.currency, settings.exchangeRate);
    } catch (error) {
      Alert.alert(
        "Could not convert price",
        error instanceof Error ? error.message : "Please try again.",
      );
      return;
    }
    const tempId = String(Date.now());
    let imageUrl = seedListings[0].image; // default placeholder

    // Upload listing image if provided
    if (imageBase64) {
      try {
        imageUrl = await saveListingPhoto(
          user.uid,
          tempId,
          imageBase64,
          imageMimeType || "image/jpeg",
        );
      } catch {
        // Non-fatal — continue with placeholder image
      }
    }

    const newListing: Listing = {
      id: tempId,
      title: title.trim(),
      price: priceInUsd,
      category: listingCategory,
      seller: user.displayName || user.email || "You",
      sellerId: user.uid,
      campus: "North Campus",
      condition: condition || "Good condition",
      image: imageUrl,
      description: description.trim() || "New listing from a campus seller.",
      status: "available",
    };
    try {
      if (db) {
        newListing.id = await createListing(newListing);
      } else {
        setItems((prev) => [newListing, ...prev]);
      }
      setSellOpen(false);
    } catch (error) {
      Alert.alert(
        "Could not publish listing",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const markAsSold = async (listingId: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const targetItem = items.find((item) => item.id === listingId);
    if (!targetItem) return;

    if (targetItem.sellerId !== user.uid) {
      Alert.alert(
        "Permission denied",
        "Only the seller/owner of this listing can mark it as sold."
      );
      return;
    }
    if (targetItem.status === "sold") {
      Alert.alert("Already sold", "This listing is already marked as sold.");
      return;
    }

    try {
      await markListingAsSold(listingId, user.uid);

      setItems((prev) =>
        prev.map((item) =>
          item.id === listingId ? { ...item, status: "sold" } : item
        )
      );
      setSelected((prev) =>
        prev && prev.id === listingId ? { ...prev, status: "sold" } : prev
      );
      Alert.alert("Item Sold", "Your listing has been successfully marked as sold.");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Could not update listing.";
      Alert.alert("Error", msg);
    }
  };
  const contactSeller = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSelected(null);
    setTab("Messages");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={settings.theme === "dark" ? "light" : "dark"} />
      {tab === "Explore" && (
        <ExplorePage
          items={filteredItems}
          query={queryText}
          category={category}
          minPrice={minPrice}
          maxPrice={maxPrice}
          sortBy={sortBy}
          savedIds={savedIds}
          photoURL={profilePhotoURL}
          currency={settings.currency}
          exchangeRate={settings.exchangeRate}
          colors={colors}
          onQueryChange={setQueryText}
          onCategoryChange={setCategory}
          onMinPriceChange={setMinPrice}
          onMaxPriceChange={setMaxPrice}
          onSortByChange={setSortBy}
          onResetFilters={resetFilters}
          onSave={toggleSaved}
          onOpen={setSelected}
          onProfile={() => setTab("Profile")}
        />
      )}
      {tab === "Saved" && (
        <SavedPage
          items={items.filter((item) => savedIds.includes(item.id))}
          currency={settings.currency}
          exchangeRate={settings.exchangeRate}
          colors={colors}
          onSave={toggleSaved}
          onOpen={setSelected}
        />
      )}
      {tab === "Messages" && (
        <MessagesPage onBrowse={() => setTab("Explore")} colors={colors} />
      )}
      {tab === "MyListings" && (
        <MyListingsPage
          items={myListings}
          currency={settings.currency}
          exchangeRate={settings.exchangeRate}
          colors={colors}
          onOpen={setSelected}
          onSell={() => setSellOpen(true)}
        />
      )}
      {tab === "Profile" && (
        <ProfilePage
          user={user}
          photoURL={profilePhotoURL}
          photoBusy={photoBusy}
          colors={colors}
          savedCount={savedIds.length}
          listingCount={myListings.length}
          firebaseConfigured={firebaseConfigured}
          profileReady={profileReady}
          error={authError}
          onMyListings={() => (user ? setTab("MyListings") : setAuthOpen(true))}
          onSaved={() => setTab("Saved")}
          onSignIn={() => setAuthOpen(true)}
          onSettings={() => setTab("Settings")}
          onUploadPhoto={uploadPhoto}
          onSignOut={() => {
            if (auth) {
              signOut(auth).catch((error) =>
                Alert.alert(
                  "Could not sign out",
                  error instanceof Error ? error.message : "Please try again.",
                ),
              );
            } else {
              setUser(null);
            }
            setTab("Profile");
          }}
        />
      )}
      {tab === "Settings" && (
        <SettingsPage
          photoURL={profilePhotoURL}
          theme={settings.theme}
          currency={settings.currency}
          exchangeRate={settings.exchangeRate}
          exchangeRateError={exchangeRateError}
          photoBusy={photoBusy}
          colors={colors}
          onBack={() => setTab("Profile")}
          onUploadPhoto={uploadPhoto}
          onThemeChange={changeTheme}
          onCurrencyChange={changeCurrency}
        />
      )}
      <BottomNav
        tab={tab}
        savedCount={savedIds.length}
        onChange={setTab}
        onSell={() => setSellOpen(true)}
        colors={colors}
      />
      <ListingModal
        item={selectedItem}
        user={user}
        onClose={() => setSelected(null)}
        onContact={contactSeller}
        onMarkAsSold={markAsSold}
        currency={settings.currency}
        exchangeRate={settings.exchangeRate}
        colors={colors}
      />
      <AuthModal
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignIn={signInWithGoogle}
        error={authError}
        colors={colors}
      />
      <SellModal
        visible={sellOpen}
        onClose={() => setSellOpen(false)}
        onSubmit={publish}
        currency={settings.currency}
        exchangeRate={settings.exchangeRate}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav({
  tab,
  savedCount,
  onChange,
  onSell,
  colors,
}: {
  tab: Tab;
  savedCount: number;
  onChange: (tab: Tab) => void;
  onSell: () => void;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.nav,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
    >
      <NavItem
        label="Explore"
        icon="⌂"
        active={tab === "Explore"}
        onPress={() => onChange("Explore")}
        colors={colors}
      />
      <NavItem
        label="Saved"
        icon="♡"
        active={tab === "Saved"}
        badge={savedCount}
        onPress={() => onChange("Saved")}
        colors={colors}
      />
      {/* Centre sell button */}
      <Pressable
        style={[styles.sellButton, { backgroundColor: colors.accent }]}
        onPress={onSell}
        accessibilityLabel="Sell an item"
        accessibilityRole="button"
      >
        <Text style={[styles.sellPlus, { color: colors.accentText }]}>＋</Text>
      </Pressable>
      <NavItem
        label="Messages"
        icon="▤"
        active={tab === "Messages"}
        onPress={() => onChange("Messages")}
        colors={colors}
      />
      <NavItem
        label="Profile"
        icon="♙"
        active={tab === "Profile"}
        onPress={() => onChange("Profile")}
        colors={colors}
      />
    </View>
  );
}

function NavItem({
  label,
  icon,
  active,
  badge,
  onPress,
  colors,
}: {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const iconScale = useRef(new Animated.Value(active ? 1.08 : 1)).current;
  const indicatorOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: active ? 1.12 : 1,
        useNativeDriver: Platform.OS !== "web",
        stiffness: 260,
        damping: 18,
        mass: 0.7,
      }),
      Animated.timing(indicatorOpacity, {
        toValue: active ? 1 : 0,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [active, iconScale, indicatorOpacity]);

  return (
    <Pressable
      style={styles.navItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.navIconWrapper, { transform: [{ scale: iconScale }] }]}>
        <Text style={[styles.navIcon, { color: active ? colors.accent : colors.muted }]}>
          {icon}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.navLabel,
          { color: active ? colors.accent : colors.muted },
          active && styles.navLabelActive,
        ]}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.navIndicator,
          {
            backgroundColor: colors.accent,
            opacity: indicatorOpacity,
            transform: [{ scaleX: indicatorOpacity }],
          },
        ]}
      />
    </Pressable>
  );
}

// ─── Listing Detail Modal ─────────────────────────────────────────────────────

function ListingModal({
  item,
  user,
  onClose,
  onContact,
  onMarkAsSold,
  currency,
  exchangeRate,
  colors,
}: {
  item: Listing | null;
  user: User | null;
  onClose: () => void;
  onContact: () => void;
  onMarkAsSold: (id: string) => void;
  currency: Currency;
  exchangeRate?: number;
  colors: ThemeColors;
}) {
  const isOwner = Boolean(user && item?.sellerId && user.uid === item.sellerId);
  const isSold = item?.status === "sold";

  const handleConfirmMarkSold = () => {
    if (!item) return;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.confirm
    ) {
      if (window.confirm("Are you sure you want to mark this item as sold?")) {
        onMarkAsSold(item.id);
      }
    } else {
      Alert.alert(
        "Mark as Sold",
        "Are you sure you want to mark this item as sold?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark as Sold",
            style: "destructive",
            onPress: () => onMarkAsSold(item.id),
          },
        ],
      );
    }
  };

  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {item && (
        <View style={styles.backdrop}>
          <View style={[styles.detail, { backgroundColor: colors.surface }]}>
            <View style={styles.detailPhotoContainer}>
              <Image source={{ uri: item.image }} style={styles.detailImage} />
              {isSold && (
                <View style={styles.modalSoldBadge}>
                  <Text style={styles.modalSoldBadgeText}>SOLD</Text>
                </View>
              )}
              <Pressable style={[styles.close, { backgroundColor: colors.surface }]} onPress={onClose}>
                <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
              </Pressable>
            </View>
            <View style={styles.detailBody}>
              <View style={styles.detailCategoryRow}>
                <Text style={[styles.detailCategory, { color: colors.accent }]}>
                  {item.category.toUpperCase()}
                </Text>
                {isSold && (
                  <View style={styles.soldInlineTag}>
                    <Text style={styles.soldInlineTagText}>SOLD</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.detailTitle, { color: colors.text }]}>{item.title}</Text>
              <Text
                style={[
                  styles.detailPrice,
                  { color: colors.accent },
                  isSold && styles.detailPriceSold,
                ]}
              >
                {formatPrice(item.price, currency, exchangeRate)}
              </Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {item.condition} · {item.campus} · {item.seller}
              </Text>
              <Text style={[styles.description, { color: colors.muted }]}>{item.description}</Text>

              {/* Action buttons */}
              {isOwner ? (
                isSold ? (
                  <View style={[styles.soldNoticeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <Text style={[styles.soldNoticeText, { color: colors.text }]}>
                      ✓ You have marked this item as sold
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.markSoldButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={handleConfirmMarkSold}
                  >
                    <Text style={[styles.markSoldButtonText, { color: colors.accentText }]}>
                      ✓ Mark as Sold
                    </Text>
                  </Pressable>
                )
              ) : isSold ? (
                <View style={[styles.soldNoticeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.soldNoticeText, { color: colors.text }]}>
                    This item has been sold
                  </Text>
                </View>
              ) : (
                <Pressable style={[styles.primary, { backgroundColor: colors.accent }]} onPress={onContact}>
                  <Text style={[styles.primaryText, { color: colors.accentText }]}>
                    {user
                      ? `Message ${item.seller}`
                      : "Sign in to contact seller"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────

function AuthModal({
  visible,
  onClose,
  onSignIn,
  error,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  error: string;
  colors: ThemeColors;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.auth, { backgroundColor: colors.surface }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Welcome to campus marketplace</Text>
          <Text style={[styles.authMessage, { color: colors.muted }]}>
            Sign in to save listings, message sellers, and publish your own
            items.
          </Text>
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <Pressable style={[styles.googleButton, { borderColor: colors.border }]} onPress={onSignIn}>
            <Text style={styles.googleMark}>G</Text>
            <Text style={[styles.outlineText, { color: colors.accent }]}>Continue with Google</Text>
          </Pressable>
          <Pressable style={[styles.outline, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.outlineText, { color: colors.accent }]}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Enhanced Sell Modal with Image Picker ────────────────────────────────────

function SellModal({
  visible,
  onClose,
  onSubmit,
  currency,
  exchangeRate,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    price: string,
    category: string,
    description: string,
    condition: string,
    imageBase64?: string,
    imageMimeType?: string,
  ) => Promise<void>;
  currency: Currency;
  exchangeRate?: number;
  colors: ThemeColors;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Textbooks");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("Good condition");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [imagePickBusy, setImagePickBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validPrice = Number.isFinite(Number(price)) && Number(price) > 0;

  const resetForm = () => {
    setTitle("");
    setPrice("");
    setCategory("Textbooks");
    setDescription("");
    setCondition("Good condition");
    setImageUri(null);
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickImage = async () => {
    setImagePickBusy(true);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission required", "Allow photo library access to add a product image.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.75,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const fileSize = asset.fileSize ?? Math.ceil(((asset.base64?.length ?? 0) * 3) / 4);
      if (fileSize >= 8 * 1024 * 1024) {
        Alert.alert("Image too large", "Please choose an image under 8 MB.");
        return;
      }
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? undefined);
      setImageMimeType(asset.mimeType ?? "image/jpeg");
    } catch (error) {
      Alert.alert("Could not pick image", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setImagePickBusy(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(title, price, category, description, condition, imageBase64, imageMimeType);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <ScrollView
          style={[styles.formScroll, { backgroundColor: colors.surface }]}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Sell an item</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
            </Pressable>
          </View>

          {/* Product Image */}
          <Text style={[styles.label, { color: colors.text }]}>Product photo</Text>
          <Pressable
            onPress={pickImage}
            disabled={imagePickBusy}
            style={[
              styles.imagePicker,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pick product image"
          >
            {imagePickBusy ? (
              <ActivityIndicator color={colors.accent} />
            ) : imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <View style={[styles.imageChangeOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Text style={styles.imageChangeText}>Tap to change</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Text style={styles.imagePickerIcon}>📷</Text>
                <Text style={[styles.imagePickerLabel, { color: colors.muted }]}>
                  Add a photo
                </Text>
                <Text style={[styles.imagePickerSub, { color: colors.muted }]}>
                  Tap to choose from gallery
                </Text>
              </View>
            )}
          </Pressable>

          {/* Title */}
          <Text style={[styles.label, { color: colors.text }]}>What are you selling?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Organic Chemistry textbook"
            placeholderTextColor={colors.muted}
            style={[
              styles.field,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
            ]}
          />

          {/* Price with currency toggle hint */}
          <Text style={[styles.label, { color: colors.text }]}>
            Price ({currency}){" "}
            <Text style={[styles.currencyHint, { color: colors.muted }]}>
              — stored in USD
            </Text>
          </Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder={formatPrice(0, currency, exchangeRate)}
            placeholderTextColor={colors.muted}
            style={[
              styles.field,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
            ]}
          />

          {/* Category chips */}
          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {SELL_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: category === cat ? colors.accent : colors.surfaceMuted,
                    borderColor: category === cat ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: category === cat ? colors.accentText : colors.muted },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Condition chips */}
          <Text style={[styles.label, { color: colors.text }]}>Condition</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CONDITION_OPTIONS.map((cond) => (
              <Pressable
                key={cond}
                onPress={() => setCondition(cond)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: condition === cond ? colors.accent : colors.surfaceMuted,
                    borderColor: condition === cond ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: condition === cond ? colors.accentText : colors.muted },
                  ]}
                >
                  {cond}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Description */}
          <Text style={[styles.label, { color: colors.text }]}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the item, any wear, included accessories..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={[
              styles.fieldMulti,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
            ]}
          />

          {/* Submit */}
          <Pressable
            disabled={!title.trim() || !validPrice || submitting}
            style={[
              styles.primary,
              { backgroundColor: colors.accent },
              (!title.trim() || !validPrice || submitting) && styles.disabled,
            ]}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Publish listing"
          >
            {submitting ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={[styles.primaryText, { color: colors.accentText }]}>
                Publish listing
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8F4" },

  // Bottom nav
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EBE5",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  navItem: { alignItems: "center", minWidth: 52, paddingTop: 2, minHeight: 52, justifyContent: "center" },
  navIconWrapper: { position: "relative" },
  navIcon: { fontSize: 24, textAlign: "center", fontWeight: "500" },
  navLabel: { fontSize: 10, marginTop: 4, fontWeight: "600" },
  navLabelActive: { fontWeight: "800" },
  navIndicator: { width: 14, height: 3, borderRadius: 2, marginTop: 4 },
  badge: {
    position: "absolute",
    right: -10,
    top: -4,
    backgroundColor: "#C3535B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  sellButton: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: "#1F5D4C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1F5D4C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  sellPlus: { fontSize: 28, lineHeight: 32, fontWeight: "500" },

  // Modals
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,40,33,.45)",
    justifyContent: "flex-end",
  },

  // Listing detail
  detail: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  detailPhotoContainer: { position: "relative" },
  modalSoldBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "#173C34",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 2,
  },
  modalSoldBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  detailImage: { width: "100%", height: 240 },
  close: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  closeText: { color: "#173C34", fontSize: 26 },
  detailBody: { padding: 24 },
  detailCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailCategory: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  soldInlineTag: {
    backgroundColor: "#E6ECE3",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  soldInlineTagText: {
    color: "#173C34",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  detailTitle: { fontSize: 25, fontWeight: "800", marginTop: 8 },
  detailPrice: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  detailPriceSold: { color: "#87918C", textDecorationLine: "line-through" },
  muted: { fontSize: 12 },
  description: { fontSize: 14, lineHeight: 21, marginVertical: 20 },
  markSoldButton: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
  },
  markSoldButtonText: { fontWeight: "800", fontSize: 14 },
  soldNoticeBox: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
  },
  soldNoticeText: { fontWeight: "700", fontSize: 13 },
  primary: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  primaryText: { fontWeight: "800" },

  // Auth modal
  auth: { borderRadius: 20, padding: 24, margin: 20 },
  authMessage: { lineHeight: 20, marginTop: 10 },
  authError: {
    color: "#B64950",
    backgroundColor: "#FBECEE",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    marginTop: 16,
  },
  googleButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 10,
  },
  googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "800" },
  outline: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  outlineText: { fontWeight: "800" },

  // Sell modal
  formScroll: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  formScrollContent: { padding: 24, paddingBottom: 40 },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  formTitle: { fontSize: 22, fontWeight: "800" },
  label: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  currencyHint: { fontWeight: "500", textTransform: "none", fontSize: 11 },
  field: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  fieldMulti: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 88,
    textAlignVertical: "top",
  },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "700" },

  // Image picker
  imagePicker: {
    height: 160,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: { width: "100%", height: "100%" },
  imageChangeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  imageChangeText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  imagePickerPlaceholder: { alignItems: "center", gap: 6 },
  imagePickerIcon: { fontSize: 36 },
  imagePickerLabel: { fontSize: 14, fontWeight: "700" },
  imagePickerSub: { fontSize: 12 },

  disabled: { opacity: 0.45 },
});

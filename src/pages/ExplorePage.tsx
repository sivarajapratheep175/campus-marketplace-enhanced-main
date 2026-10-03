import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "../components/EmptyState";
import { ListingCard } from "../components/ListingCard";
import { categories } from "../data";
import { Currency, formatPrice } from "../currency";
import { ThemeColors } from "../theme";
import { Listing } from "../types";

export function ExplorePage({
  items,
  query,
  category,
  maxPrice,
  sortBy,
  savedIds,
  photoURL,
  currency,
  exchangeRate,
  colors,
  onQueryChange,
  onCategoryChange,
  onMaxPriceChange,
  onSortByChange,
  onResetFilters,
  onSave,
  onOpen,
  onProfile,
}: {
  items: Listing[];
  query: string;
  category: string;
  maxPrice: number | null;
  sortBy: "newest" | "price-asc" | "price-desc";
  savedIds: string[];
  photoURL: string | null;
  currency: Currency;
  exchangeRate?: number;
  colors: ThemeColors;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMaxPriceChange: (value: number | null) => void;
  onSortByChange: (value: "newest" | "price-asc" | "price-desc") => void;
  onResetFilters: () => void;
  onSave: (id: string) => void;
  onOpen: (item: Listing) => void;
  onProfile: () => void;
}) {
  const hasActiveFilters =
    query.trim().length > 0 ||
    category !== "All items" ||
    maxPrice !== null ||
    sortBy !== "newest";
  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>CAMPUS MARKETPLACE</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Find your next{"\n"}favorite thing.
          </Text>
        </View>
        <Pressable
          style={[styles.avatar, { backgroundColor: colors.accentSoft }]}
          onPress={onProfile}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.accent }]}>?</Text>
          )}
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.icon, { color: colors.muted }]}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search textbooks, desks, tech..."
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text }]}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => onQueryChange("")}
            hitSlop={8}
            style={[styles.clearBtn, { backgroundColor: colors.surfaceMuted }]}
          >
            <Text style={[styles.clearText, { color: colors.muted }]}>✕</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.section}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse near you</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>Good finds, close by</Text>
        </View>
        <Text style={[styles.seeAll, { color: colors.accent }]}>{items.length} items</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map((value) => (
          <Pressable
            key={value}
            onPress={() => onCategoryChange(value)}
            style={[
              styles.category,
              {
                backgroundColor:
                  category === value ? colors.accent : colors.surfaceMuted,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: category === value ? colors.accentText : colors.muted },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sort & Price Filters */}
      <View
        style={[
          styles.filterSection,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.filterGroupTitle, { color: colors.muted }]}>
          Sort by Price
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            onPress={() => onSortByChange("newest")}
            style={[
              styles.filterChip,
              {
                backgroundColor: sortBy === "newest" ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: sortBy === "newest" ? colors.accentText : colors.text },
              ]}
            >
              Newest
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSortByChange("price-asc")}
            style={[
              styles.filterChip,
              {
                backgroundColor: sortBy === "price-asc" ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: sortBy === "price-asc" ? colors.accentText : colors.text },
              ]}
            >
              Price: Low to High ↑
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSortByChange("price-desc")}
            style={[
              styles.filterChip,
              {
                backgroundColor: sortBy === "price-desc" ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: sortBy === "price-desc" ? colors.accentText : colors.text },
              ]}
            >
              Price: High to Low ↓
            </Text>
          </Pressable>
        </ScrollView>

        <Text style={[styles.filterGroupTitle, { color: colors.muted, marginTop: 12 }]}>
          Max Price
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            onPress={() => onMaxPriceChange(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: maxPrice === null ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: maxPrice === null ? colors.accentText : colors.text },
              ]}
            >
              All Prices
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onMaxPriceChange(40)}
            style={[
              styles.filterChip,
              {
                backgroundColor: maxPrice === 40 ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: maxPrice === 40 ? colors.accentText : colors.text },
              ]}
            >
              Under {formatPrice(40, currency, exchangeRate)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onMaxPriceChange(80)}
            style={[
              styles.filterChip,
              {
                backgroundColor: maxPrice === 80 ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: maxPrice === 80 ? colors.accentText : colors.text },
              ]}
            >
              Under {formatPrice(80, currency, exchangeRate)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onMaxPriceChange(120)}
            style={[
              styles.filterChip,
              {
                backgroundColor: maxPrice === 120 ? colors.accent : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: maxPrice === 120 ? colors.accentText : colors.text },
              ]}
            >
              Under {formatPrice(120, currency, exchangeRate)}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <View style={[styles.activeFiltersBar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.activeFiltersCount, { color: colors.accent }]}>
            {items.length} {items.length === 1 ? "item found" : "items found"}
          </Text>
          <Pressable onPress={onResetFilters} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Clear all filters ✕</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={items}
        scrollEnabled={false}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <EmptyState
            colors={colors}
            title="No items found"
            message={
              query
                ? `We couldn't find anything matching "${query}". Try checking your spelling or clearing filters.`
                : "No items match your selected category or price filters."
            }
            action="Clear all filters"
            onAction={onResetFilters}
          />
        }
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            saved={savedIds.includes(item.id)}
            currency={currency}
            exchangeRate={exchangeRate}
            colors={colors}
            onSave={() => onSave(item.id)}
            onOpen={() => onOpen(item)}
          />
        )}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 28,
    paddingBottom: 24,
  },
  eyebrow: {
    color: "#65766D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  heading: {
    color: "#173C34",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D6E5D7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { color: "#225347", fontWeight: "800" },
  search: {
    height: 52,
    backgroundColor: "#FFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#E6E9E2",
  },
  icon: { color: "#49635A", fontSize: 28, marginRight: 8 },
  input: { flex: 1, color: "#173C34", fontSize: 14 },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#ECEFE9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  clearText: {
    color: "#65766D",
    fontSize: 12,
    fontWeight: "bold",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#173C34",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  muted: { color: "#87918C", fontSize: 12 },
  seeAll: { color: "#23775D", fontWeight: "700", fontSize: 12 },
  categories: { gap: 8, paddingBottom: 22 },
  category: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#ECEFE9",
  },
  activeCategory: { backgroundColor: "#1F5D4C" },
  categoryText: { color: "#64736C", fontSize: 12, fontWeight: "700" },
  activeText: { color: "#FFF" },
  grid: { gap: 14 },
  columns: { gap: 14 },
  empty: { textAlign: "center", color: "#87918C", padding: 30 },
  filterSection: {
    backgroundColor: "#F7F9F6",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E6ECE3",
  },
  filterGroupTitle: {
    color: "#5C6E66",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDE4DA",
  },
  activeFilterChip: {
    backgroundColor: "#1F5D4C",
    borderColor: "#1F5D4C",
  },
  filterChipText: {
    color: "#54655E",
    fontSize: 12,
    fontWeight: "600",
  },
  activeFilterChipText: {
    color: "#FFF",
    fontWeight: "700",
  },
  activeFiltersBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E8F1EC",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  activeFiltersCount: {
    color: "#1F5D4C",
    fontSize: 12,
    fontWeight: "700",
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(195, 83, 91, 0.1)",
  },
  resetBtnText: {
    color: "#C3535B",
    fontSize: 12,
    fontWeight: "700",
  },
});

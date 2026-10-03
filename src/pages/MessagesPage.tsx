import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PageTitle } from "../components/PageTitle";
import { ThemeColors } from "../theme";

// Demo message thread data for a realistic placeholder
const DEMO_THREADS = [
  {
    id: "1",
    seller: "Alex M.",
    initials: "AM",
    item: "MacBook Pro 2021",
    preview: "Hey! Is the laptop still available?",
    time: "2m ago",
    unread: true,
  },
  {
    id: "2",
    seller: "Priya S.",
    initials: "PS",
    item: "Organic Chemistry Textbook",
    preview: "Sure, I can meet at the library tomorrow.",
    time: "1h ago",
    unread: false,
  },
  {
    id: "3",
    seller: "James T.",
    initials: "JT",
    item: "Standing Desk (adjustable)",
    preview: "Can you do Rs 12,000 for the desk?",
    time: "Yesterday",
    unread: false,
  },
];

export function MessagesPage({
  onBrowse,
  colors,
}: {
  onBrowse: () => void;
  colors: ThemeColors;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <PageTitle title="Messages" subtitle="Keep campus meetups simple" colors={colors} />

      {/* Search bar placeholder */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.searchIcon, { color: colors.muted }]}>🔍</Text>
        <Text style={[styles.searchPlaceholder, { color: colors.muted }]}>
          Search conversations…
        </Text>
      </View>

      {/* Demo threads */}
      <View style={[styles.threadList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {DEMO_THREADS.map((thread, index) => (
          <View key={thread.id}>
            <Pressable
              style={styles.thread}
              onPress={onBrowse}
              accessibilityRole="button"
              accessibilityLabel={`Message from ${thread.seller} about ${thread.item}`}
            >
              {/* Avatar */}
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: thread.unread ? colors.accentSoft : colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {thread.initials}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.threadContent}>
                <View style={styles.threadHeader}>
                  <Text
                    style={[
                      styles.threadSeller,
                      { color: colors.text },
                      thread.unread && styles.threadSellerBold,
                    ]}
                  >
                    {thread.seller}
                  </Text>
                  <Text style={[styles.threadTime, { color: colors.muted }]}>
                    {thread.time}
                  </Text>
                </View>
                <Text style={[styles.threadItem, { color: colors.accent }]} numberOfLines={1}>
                  {thread.item}
                </Text>
                <Text
                  style={[
                    styles.threadPreview,
                    { color: thread.unread ? colors.text : colors.muted },
                    thread.unread && styles.threadPreviewBold,
                  ]}
                  numberOfLines={1}
                >
                  {thread.preview}
                </Text>
              </View>

              {/* Unread dot */}
              {thread.unread && (
                <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
              )}
            </Pressable>
            {index < DEMO_THREADS.length - 1 && (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            )}
          </View>
        ))}
      </View>

      {/* Footer CTA */}
      <View style={styles.ctaBox}>
        <Text style={[styles.ctaTitle, { color: colors.text }]}>
          💬 Start a conversation
        </Text>
        <Text style={[styles.ctaSub, { color: colors.muted }]}>
          Tap "Message Seller" on any listing to connect with campus sellers.
        </Text>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.accentSoft }]}
          onPress={onBrowse}
          accessibilityRole="button"
          accessibilityLabel="Browse listings to message sellers"
        >
          <Text style={[styles.ctaButtonText, { color: colors.accent }]}>
            Browse listings →
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },

  searchBar: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 20,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { fontSize: 14 },

  threadList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  thread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", fontSize: 15 },
  threadContent: { flex: 1, gap: 2 },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  threadSeller: { fontSize: 14, fontWeight: "600" },
  threadSellerBold: { fontWeight: "800" },
  threadTime: { fontSize: 11 },
  threadItem: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  threadPreview: { fontSize: 13, marginTop: 1 },
  threadPreviewBold: { fontWeight: "700" },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  divider: { height: 1, marginLeft: 76 },

  ctaBox: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  ctaTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  ctaSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  ctaButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaButtonText: { fontWeight: "800", fontSize: 14 },
});

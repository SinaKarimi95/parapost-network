"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  Suspense,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
  last_seen_at?: string | null;
};

type ConversationRow = {
  id: string;
  user_one_id: string | null;
  user_two_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ConversationHideRow = {
  conversation_id: string;
  user_id: string;
  hidden_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  is_read?: boolean | null;
  message_type?: "text" | "image" | null;
  image_path?: string | null;
  image_mime_type?: string | null;
  image_size_bytes?: number | null;
  image_width?: number | null;
  image_height?: number | null;
  signedImageUrl?: string | null;
};

type ParachatImageDraft = {
  blob: Blob;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

type ParachatImageViewer = {
  url: string;
  alt: string;
  caption: string;
  senderName: string;
  timeLabel: string;
  isMine: boolean;
};

type ConversationItem = ConversationRow & {
  otherUserId: string;
  otherProfile: ProfileRow | null;
  lastMessage: MessageRow | null;
  unreadCount: number;
  isNewFriend: boolean;
};

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const sameYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (sameDay) return "Today";
  if (sameYesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitial(profile?: ProfileRow | null) {
  const value = profile?.full_name || profile?.username || "U";
  return value.charAt(0).toUpperCase();
}

function getProfileName(profile?: ProfileRow | null) {
  return profile?.full_name || profile?.username || "Parapost Member";
}

const PARACHAT_ONLINE_TIMEOUT_MS = 3 * 60 * 1000;

const PARACHAT_IMAGE_BUCKET = "parachat-images";
const PARACHAT_MAX_IMAGE_DIMENSION = 1600;
const PARACHAT_TARGET_IMAGE_BYTES = 1_200_000;
const PARACHAT_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const DIRECT_MESSAGE_SELECT =
  "id, conversation_id, sender_id, body, created_at, is_read, message_type, image_path, image_mime_type, image_size_bytes, image_width, image_height";

function isImageMessage(message?: MessageRow | null) {
  return Boolean(message?.message_type === "image" || message?.image_path);
}

function getConversationPreviewText(conversation: ConversationItem) {
  if (conversation.isNewFriend) return "New friend · Start a Parachat";

  if (isImageMessage(conversation.lastMessage)) {
    const caption = conversation.lastMessage?.body?.trim();
    return caption ? `Photo · ${caption}` : "Photo message";
  }

  return conversation.lastMessage?.body || "No messages yet";
}

function buildParachatImagePath(
  conversationId: string,
  viewerId: string,
  fileName: string
) {
  const cleanBaseName =
    fileName
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "parachat-image";

  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${viewerId}/${conversationId}/${Date.now()}-${randomPart}-${cleanBaseName}.jpg`;
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image. Please try another photo."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

async function compressParachatImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (!PARACHAT_ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please use a JPG, PNG, or WebP image for Parachat.");
  }

  const originalUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(originalUrl);

    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;

    if (!originalWidth || !originalHeight) {
      throw new Error("This image could not be prepared.");
    }

    const largestSide = Math.max(originalWidth, originalHeight);
    const scale =
      largestSide > PARACHAT_MAX_IMAGE_DIMENSION
        ? PARACHAT_MAX_IMAGE_DIMENSION / largestSide
        : 1;

    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser could not prepare the image.");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.84;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);

    while (blob.size > PARACHAT_TARGET_IMAGE_BYTES && quality > 0.58) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }

    return {
      blob,
      fileName: `${file.name.replace(/\.[^.]+$/i, "") || "parachat-image"}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

async function attachSignedImageUrlToMessage(message: MessageRow) {
  if (!message.image_path) return message;

  const { data, error } = await supabase.storage
    .from(PARACHAT_IMAGE_BUCKET)
    .createSignedUrl(message.image_path, 60 * 60);

  if (error || !data?.signedUrl) {
    console.warn("Could not create Parachat image URL:", error?.message);
    return { ...message, signedImageUrl: null };
  }

  return { ...message, signedImageUrl: data.signedUrl };
}

async function attachSignedImageUrls(messages: MessageRow[]) {
  return Promise.all(messages.map((message) => attachSignedImageUrlToMessage(message)));
}

function isRecentParachatOnlineTimestamp(value?: string | null) {
  if (!value) return false;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;

  return Date.now() - time <= PARACHAT_ONLINE_TIMEOUT_MS;
}

function isParachatProfileActuallyOnline(profile?: ProfileRow | null) {
  return Boolean(profile?.is_online && isRecentParachatOnlineTimestamp(profile.last_seen_at));
}

function getConversationOtherUserId(conversation: ConversationRow, viewerId: string) {
  return conversation.user_one_id === viewerId
    ? conversation.user_two_id || ""
    : conversation.user_one_id || "";
}

function buildAcceptedFriendIdSet(
  rows: Array<{ sender_id?: string | null; receiver_id?: string | null; status?: string | null }> | null | undefined,
  viewerId: string
) {
  const friendIds = new Set<string>();

  for (const row of rows || []) {
    if (row.status !== "accepted") continue;

    const otherId = row.sender_id === viewerId ? row.receiver_id : row.receiver_id === viewerId ? row.sender_id : "";
    if (otherId) friendIds.add(otherId);
  }

  return friendIds;
}

async function updateParachatPresence(viewerId: string, isOnline: boolean) {
  if (!viewerId) return;

  try {
    await supabase
      .from("profiles")
      .update({ is_online: isOnline, last_seen_at: new Date().toISOString() })
      .eq("id", viewerId);
  } catch {
    // Presence updates should never interrupt Parachat.
  }
}

async function ensureParachatConversationsForFriends(viewerId: string, friendIds: string[]) {
  const safeFriendIds = [...new Set(friendIds.filter((friendId) => friendId && friendId !== viewerId))];

  if (safeFriendIds.length === 0) return;

  const results = await Promise.allSettled(
    safeFriendIds.map((friendId) =>
      supabase.rpc("get_or_create_direct_conversation", {
        other_user_id: friendId,
      })
    )
  );

  const failedCount = results.filter((result) => {
    if (result.status === "rejected") return true;
    return Boolean(result.value.error);
  }).length;

  if (failedCount > 0) {
    console.warn(`Could not prepare ${failedCount} Parachat friend conversation${failedCount === 1 ? "" : "s"}.`);
  }
}


function updateConversationUrl(conversationId: string) {
  if (typeof window === "undefined" || !conversationId) return;
  const nextUrl = `/messages?conversation=${conversationId}`;
  window.history.replaceState(null, "", nextUrl);
}

function clearConversationUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/messages");
}

function getParachatErrorMessage(message?: string | null) {
  const cleanMessage = message || "";

  if (
    cleanMessage.includes("friends_only_parachat") ||
    cleanMessage.toLowerCase().includes("row-level security") ||
    cleanMessage.toLowerCase().includes("violates row-level security")
  ) {
    return "Parachat is only available between accepted friends.";
  }

  return cleanMessage || "Parachat needs attention. Please try again.";
}

export default function MessagesPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#05070a",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
          }}
        >
          Loading Parachat...
        </div>
      }
    >
      <MessagesPage />
    </Suspense>
  );
}

function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedConversationFromUrl = searchParams.get("conversation") || "";

  const [viewerId, setViewerId] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState(selectedConversationFromUrl);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(!!selectedConversationFromUrl);
  const [selectedImage, setSelectedImage] = useState<ParachatImageDraft | null>(null);
  const [imageError, setImageError] = useState("");
  const [compressingImage, setCompressingImage] = useState(false);
  const [imageViewer, setImageViewer] = useState<ParachatImageViewer | null>(null);

  const messagesAreaRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImagePreviewUrlRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef(selectedConversationFromUrl);
  const conversationsRef = useRef<ConversationItem[]>([]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedImagePreviewUrlRef.current = selectedImage?.previewUrl || null;
  }, [selectedImage?.previewUrl]);

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrlRef.current) {
        URL.revokeObjectURL(selectedImagePreviewUrlRef.current);
      }
    };
  }, []);

  const clearSelectedImage = useCallback(() => {
    setSelectedImage((currentImage) => {
      if (currentImage?.previewUrl) {
        URL.revokeObjectURL(currentImage.previewUrl);
      }

      return null;
    });

    setImageError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);


  const activeConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const handleOpenImageViewer = useCallback(
    (message: MessageRow, isMine: boolean) => {
      if (!message.signedImageUrl) return;

      setImageViewer({
        url: message.signedImageUrl,
        alt: message.body?.trim() || "Parachat photo",
        caption: message.body?.trim() || "",
        senderName: isMine
          ? "You"
          : activeConversation?.otherProfile
            ? getProfileName(activeConversation.otherProfile)
            : "Parapost Member",
        timeLabel: formatMessageTime(message.created_at),
        isMine,
      });
    },
    [activeConversation?.otherProfile]
  );

  const handleCloseImageViewer = useCallback(() => {
    setImageViewer(null);
  }, []);

  useEffect(() => {
    if (!imageViewer) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setImageViewer(null);
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imageViewer]);

  const activeConversationIsAcceptedFriend = useMemo(() => {
    return Boolean(
      activeConversation?.otherUserId && acceptedFriendIds.includes(activeConversation.otherUserId)
    );
  }, [acceptedFriendIds, activeConversation?.otherUserId]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter((conversation) => {
      const profile = conversation.otherProfile;
      const name = getProfileName(profile).toLowerCase();
      const username = profile?.username?.toLowerCase() || "";
      const lastMessage = getConversationPreviewText(conversation).toLowerCase();
      const newFriendLabel = conversation.isNewFriend ? "new friend start parachat" : "";

      return (
        name.includes(term) ||
        username.includes(term) ||
        lastMessage.includes(term) ||
        newFriendLabel.includes(term)
      );
    });
  }, [conversations, searchText]);

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: MessageRow[] }[] = [];

    for (const message of messages) {
      const label = formatDateLabel(message.created_at);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, items: [message] });
      } else {
        lastGroup.items.push(message);
      }
    }

    return groups;
  }, [messages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;

    const scrollNow = () => {
      const messagesArea = messagesAreaRef.current;

      if (messagesArea) {
        messagesArea.scrollTo({
          top: messagesArea.scrollHeight,
          behavior,
        });
      }

      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    };

    // Run more than once because image messages can change height after the first render.
    window.setTimeout(scrollNow, 0);
    window.setTimeout(scrollNow, 90);
    window.setTimeout(scrollNow, 260);
    window.setTimeout(scrollNow, 650);
  }, []);

  const markConversationRead = useCallback(
    async (conversationId: string, currentViewerId: string) => {
      if (!conversationId || !currentViewerId) return;

      const { error } = await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentViewerId)
        .eq("is_read", false);

      if (error) {
        console.warn("Mark read warning:", error.message);
        return;
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    },
    []
  );

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/");
      return;
    }

    setViewerId(user.id);

    const { data: friendshipRows, error: friendshipError } = await supabase
      .from("friend_requests")
      .select("sender_id, receiver_id, status")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (friendshipError) {
      setErrorMessage(getParachatErrorMessage(friendshipError.message || "Could not verify your friends list for Parachat."));
      setAcceptedFriendIds([]);
      setConversations([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setMessages([]);
      setMobileChatOpen(false);
      clearConversationUrl();
      setLoadingInbox(false);
      return;
    }

    const acceptedFriendIdSet = buildAcceptedFriendIdSet(friendshipRows, user.id);
    const nextAcceptedFriendIds = Array.from(acceptedFriendIdSet);
    setAcceptedFriendIds(nextAcceptedFriendIds);

    if (nextAcceptedFriendIds.length === 0) {
      setConversations([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setMessages([]);
      setMobileChatOpen(false);
      clearConversationUrl();
      setLoadingInbox(false);
      return;
    }

    let { data: conversationData, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("id, user_one_id, user_two_id, created_at, updated_at")
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (conversationError) {
      setErrorMessage(getParachatErrorMessage(conversationError.message || "Could not load conversations."));
      setLoadingInbox(false);
      return;
    }

    let allRawConversations = ((conversationData as ConversationRow[]) || []).filter(Boolean);

    const existingConversationFriendIds = new Set(
      allRawConversations
        .map((conversation) => getConversationOtherUserId(conversation, user.id))
        .filter(Boolean)
    );

    const missingFriendIds = nextAcceptedFriendIds.filter(
      (friendId) => !existingConversationFriendIds.has(friendId)
    );

    if (missingFriendIds.length > 0) {
      await ensureParachatConversationsForFriends(user.id, missingFriendIds);

      const refreshed = await supabase
        .from("direct_conversations")
        .select("id, user_one_id, user_two_id, created_at, updated_at")
        .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      if (refreshed.error) {
        setErrorMessage(getParachatErrorMessage(refreshed.error.message || "Could not refresh Parachat conversations."));
        setLoadingInbox(false);
        return;
      }

      conversationData = refreshed.data;
      allRawConversations = ((conversationData as ConversationRow[]) || []).filter(Boolean);
    }

    const { data: hiddenConversationRows, error: hiddenConversationError } = await supabase
      .from("direct_conversation_hides")
      .select("conversation_id, user_id, hidden_at")
      .eq("user_id", user.id);

    if (hiddenConversationError) {
      console.warn("Hidden conversation warning:", hiddenConversationError.message);
    }

    const hiddenMap = new Map(
      ((hiddenConversationRows as ConversationHideRow[]) || [])
        .filter((row) => row.conversation_id)
        .map((row) => [row.conversation_id, row.hidden_at || ""])
    );

    const visibleConversations = allRawConversations.filter((conversation) => {
      const hiddenAt = hiddenMap.get(conversation.id);
      if (!hiddenAt) return true;

      const conversationTime = new Date(
        conversation.updated_at || conversation.created_at || 0
      ).getTime();
      const hiddenTime = new Date(hiddenAt).getTime();

      if (Number.isNaN(conversationTime) || Number.isNaN(hiddenTime)) return false;

      // If someone sends a newer message after the user hid the chat,
      // the conversation can appear again naturally.
      return conversationTime > hiddenTime;
    });

    const rawConversations = visibleConversations.filter((conversation) => {
      const otherUserId = getConversationOtherUserId(conversation, user.id);
      return Boolean(otherUserId && acceptedFriendIdSet.has(otherUserId));
    });

    if (rawConversations.length === 0) {
      setConversations([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setMessages([]);
      setMobileChatOpen(false);
      clearConversationUrl();
      setLoadingInbox(false);
      return;
    }

    const otherUserIds = [
      ...new Set(
        rawConversations
          .map((conversation) => getConversationOtherUserId(conversation, user.id))
          .filter(Boolean)
      ),
    ];

    const conversationIds = rawConversations.map((conversation) => conversation.id);

    const [{ data: profileData }, { data: messageData, error: messagesError }] =
      await Promise.all([
        otherUserIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url, is_online, last_seen_at")
              .in("id", otherUserIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("direct_messages")
          .select(DIRECT_MESSAGE_SELECT)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
      ]);

    if (messagesError) {
      setErrorMessage(getParachatErrorMessage(messagesError.message || "Could not load messages."));
      setLoadingInbox(false);
      return;
    }

    const profileMap = new Map(
      ((profileData as ProfileRow[]) || []).map((profile) => [profile.id, profile])
    );

    const allMessages = ((messageData as MessageRow[]) || []).filter(Boolean);

    const nextItems: ConversationItem[] = rawConversations
      .map((conversation) => {
        const otherUserId = getConversationOtherUserId(conversation, user.id);

        const conversationMessages = allMessages.filter(
          (message) => message.conversation_id === conversation.id
        );

        const lastMessage =
          conversationMessages.sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0] || null;

        const unreadCount = conversationMessages.filter(
          (message) => message.sender_id !== user.id && message.is_read === false
        ).length;

        return {
          ...conversation,
          otherUserId,
          otherProfile: profileMap.get(otherUserId) || null,
          lastMessage,
          unreadCount,
          isNewFriend: !lastMessage,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(
          a.lastMessage?.created_at || a.updated_at || a.created_at || 0
        ).getTime();
        const bTime = new Date(
          b.lastMessage?.created_at || b.updated_at || b.created_at || 0
        ).getTime();
        return bTime - aTime;
      });

    setConversations(nextItems);

    const urlConversationValid = nextItems.some(
      (conversation) => conversation.id === selectedConversationFromUrl
    );

    const activeConversationStillValid = Boolean(
      activeConversationIdRef.current &&
        nextItems.some((conversation) => conversation.id === activeConversationIdRef.current)
    );

    const nextActiveId = urlConversationValid
      ? selectedConversationFromUrl
      : activeConversationStillValid
        ? activeConversationIdRef.current
        : "";

    setActiveConversationId(nextActiveId);
    activeConversationIdRef.current = nextActiveId;

    if (selectedConversationFromUrl && urlConversationValid) {
      setMobileChatOpen(true);
    }

    if (selectedConversationFromUrl && !urlConversationValid) {
      clearConversationUrl();
      setMobileChatOpen(false);
    }

    if (!nextActiveId) {
      setMessages([]);
      setMobileChatOpen(false);
    }

    setLoadingInbox(false);
  }, [router, selectedConversationFromUrl]);

  const loadMessages = useCallback(
    async (conversationId: string, currentViewerId: string) => {
      if (!conversationId || !currentViewerId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(false);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("direct_messages")
        .select(DIRECT_MESSAGE_SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(getParachatErrorMessage(error.message || "Could not load this conversation."));
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      const preparedMessages = await attachSignedImageUrls((data as MessageRow[]) || []);
      setMessages(preparedMessages);
      await markConversationRead(conversationId, currentViewerId);
      setLoadingMessages(false);
      scrollToBottom("auto");
    },
    [markConversationRead, scrollToBottom]
  );

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!viewerId || typeof window === "undefined") return;

    let cancelled = false;

    const updatePresence = async (isOnline: boolean) => {
      if (cancelled) return;
      await updateParachatPresence(viewerId, isOnline);
    };

    const shouldMarkOnline = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
      return true;
    };

    const markOnlineIfVisible = () => {
      if (!shouldMarkOnline()) return;
      void updatePresence(true);
    };

    void updatePresence(true);

    const heartbeatId = window.setInterval(markOnlineIfVisible, 45000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markOnlineIfVisible();
        return;
      }

      void updatePresence(false);
    };

    const handlePageHide = () => {
      void updatePresence(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [viewerId]);

  useEffect(() => {
    if (!viewerId || !activeConversationId) return;

    loadMessages(activeConversationId, viewerId);
  }, [activeConversationId, viewerId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId || loadingMessages) return;

    scrollToBottom("auto");
  }, [activeConversationId, loadingMessages, messages.length, scrollToBottom]);

  useEffect(() => {
    const closeConversationMenu = () => setOpenConversationMenuId(null);
    window.addEventListener("click", closeConversationMenu);

    return () => {
      window.removeEventListener("click", closeConversationMenu);
    };
  }, []);

  useEffect(() => {
    if (!viewerId) return;

    const channel = supabase
      .channel(`parachat-hub-${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        async (payload) => {
          const nextMessage = await attachSignedImageUrlToMessage(payload.new as MessageRow);

          const belongsToUser = conversationsRef.current.some(
            (conversation) => conversation.id === nextMessage.conversation_id
          );

          if (!belongsToUser) {
            await loadInbox();
            return;
          }

          setConversations((prev) =>
            prev
              .map((conversation) => {
                if (conversation.id !== nextMessage.conversation_id) return conversation;

                const isActive = activeConversationId === nextMessage.conversation_id;
                const isMine = nextMessage.sender_id === viewerId;

                return {
                  ...conversation,
                  lastMessage: nextMessage,
                  isNewFriend: false,
                  unreadCount:
                    !isActive && !isMine
                      ? conversation.unreadCount + 1
                      : conversation.unreadCount,
                  updated_at: nextMessage.created_at,
                };
              })
              .sort((a, b) => {
                const aTime = new Date(
                  a.lastMessage?.created_at || a.updated_at || 0
                ).getTime();
                const bTime = new Date(
                  b.lastMessage?.created_at || b.updated_at || 0
                ).getTime();
                return bTime - aTime;
              })
          );

          if (nextMessage.conversation_id === activeConversationId) {
            setMessages((prev) => {
              if (prev.some((message) => message.id === nextMessage.id)) return prev;
              return [...prev, nextMessage];
            });

            if (nextMessage.sender_id !== viewerId) {
              await markConversationRead(nextMessage.conversation_id, viewerId);
            }

            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    activeConversationId,
    loadInbox,
    markConversationRead,
    scrollToBottom,
    viewerId,
  ]);

  const handleDeleteConversation = async (conversation: ConversationItem) => {
    if (!viewerId || !conversation.id) return;

    const otherName = getProfileName(conversation.otherProfile);
    const confirmed = window.confirm(
      `Delete this Parachat with ${otherName} from your inbox? This hides the conversation for you.`
    );

    if (!confirmed) return;

    setDeletingConversationId(conversation.id);
    setOpenConversationMenuId(null);
    setStatusMessage("");
    setErrorMessage("");

    const hiddenAt = new Date().toISOString();

    const { data: existingHide, error: existingHideError } = await supabase
      .from("direct_conversation_hides")
      .select("conversation_id")
      .eq("conversation_id", conversation.id)
      .eq("user_id", viewerId)
      .maybeSingle();

    if (existingHideError) {
      setErrorMessage(`Could not check this Parachat delete status: ${getParachatErrorMessage(existingHideError.message)}`);
      setDeletingConversationId(null);
      return;
    }

    const { error } = existingHide
      ? await supabase
          .from("direct_conversation_hides")
          .update({ hidden_at: hiddenAt })
          .eq("conversation_id", conversation.id)
          .eq("user_id", viewerId)
      : await supabase
          .from("direct_conversation_hides")
          .insert({
            conversation_id: conversation.id,
            user_id: viewerId,
            hidden_at: hiddenAt,
          });

    if (error) {
      setErrorMessage(`Could not delete this Parachat from your inbox: ${getParachatErrorMessage(error.message)}`);
      setDeletingConversationId(null);
      return;
    }

    const remainingConversations = conversations.filter((item) => item.id !== conversation.id);
    setConversations(remainingConversations);

    if (activeConversationId === conversation.id) {
      setMessages([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setMobileChatOpen(false);
      clearConversationUrl();
    }

    setDeletingConversationId(null);
    setStatusMessage(`Parachat with ${otherName} was removed from your inbox.`);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) {
      setOpenConversationMenuId(null);
      setMobileChatOpen(true);
      updateConversationUrl(conversationId);
      scrollToBottom("smooth");
      return;
    }

    setOpenConversationMenuId(null);
    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    setMobileChatOpen(true);
    updateConversationUrl(conversationId);

    if (viewerId) {
      void markConversationRead(conversationId, viewerId);
    }

    scrollToBottom("auto");
  };

  const handleMobileBackToInbox = () => {
    setOpenConversationMenuId(null);
    setMobileChatOpen(false);
  };

  const handleCloseActiveConversation = () => {
    setOpenConversationMenuId(null);
    setActiveConversationId("");
    activeConversationIdRef.current = "";
    setMessages([]);
    setMessageText("");
    clearSelectedImage();
    setImageViewer(null);
    setMobileChatOpen(false);
    clearConversationUrl();

    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(event.target.value);

    const textarea = event.currentTarget;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 130)}px`;
  };

  const handleSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!activeConversationIsAcceptedFriend) {
      setImageError("Parachat photos are only available between accepted friends.");
      event.currentTarget.value = "";
      return;
    }

    setImageError("");
    setCompressingImage(true);

    try {
      const compressedImage = await compressParachatImage(file);
      const previewUrl = URL.createObjectURL(compressedImage.blob);

      setSelectedImage((currentImage) => {
        if (currentImage?.previewUrl) {
          URL.revokeObjectURL(currentImage.previewUrl);
        }

        return {
          previewUrl,
          ...compressedImage,
        };
      });
    } catch (error) {
      setSelectedImage(null);
      setImageError(error instanceof Error ? error.message : "Could not prepare this photo.");
      event.currentTarget.value = "";
    } finally {
      setCompressingImage(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    const imageDraft = selectedImage;

    if ((!trimmed && !imageDraft) || sending || compressingImage || !viewerId || !activeConversationId) return;

    if (!activeConversationIsAcceptedFriend) {
      setErrorMessage("Parachat is only available between accepted friends.");
      return;
    }

    setSending(true);
    setErrorMessage("");
    setImageError("");

    let uploadedImagePath: string | null = null;

    if (imageDraft) {
      uploadedImagePath = buildParachatImagePath(
        activeConversationId,
        viewerId,
        imageDraft.fileName
      );

      const { error: uploadError } = await supabase.storage
        .from(PARACHAT_IMAGE_BUCKET)
        .upload(uploadedImagePath, imageDraft.blob, {
          cacheControl: "3600",
          contentType: imageDraft.mimeType,
          upsert: false,
        });

      if (uploadError) {
        setErrorMessage(getParachatErrorMessage(uploadError.message || "Photo could not be uploaded."));
        setSending(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("direct_messages")
      .insert([
        {
          conversation_id: activeConversationId,
          sender_id: viewerId,
          body: trimmed || null,
          is_read: false,
          message_type: imageDraft ? "image" : "text",
          image_path: uploadedImagePath,
          image_mime_type: imageDraft?.mimeType || null,
          image_size_bytes: imageDraft?.sizeBytes || null,
          image_width: imageDraft?.width || null,
          image_height: imageDraft?.height || null,
        },
      ])
      .select(DIRECT_MESSAGE_SELECT)
      .single();

    if (error) {
      if (uploadedImagePath) {
        await supabase.storage.from(PARACHAT_IMAGE_BUCKET).remove([uploadedImagePath]);
      }

      setErrorMessage(getParachatErrorMessage(error.message || "Message could not be sent."));
      setSending(false);
      return;
    }

    if (data) {
      const sentMessage = await attachSignedImageUrlToMessage(data as MessageRow);

      setMessages((prev) => {
        if (prev.some((message) => message.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });

      setConversations((prev) =>
        prev
          .map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  lastMessage: sentMessage,
                  isNewFriend: false,
                  updated_at: sentMessage.created_at,
                }
              : conversation
          )
          .sort((a, b) => {
            const aTime = new Date(
              a.lastMessage?.created_at || a.updated_at || 0
            ).getTime();
            const bTime = new Date(
              b.lastMessage?.created_at || b.updated_at || 0
            ).getTime();
            return bTime - aTime;
          })
      );
    }

    await supabase
      .from("direct_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId);

    setMessageText("");
    clearSelectedImage();

    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
      textareaRef.current.focus();
    }

    setSending(false);
    scrollToBottom();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSendMessage();
  };

  const handleComposerKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const activeProfile = activeConversation?.otherProfile || null;
  const activeName = getProfileName(activeProfile);
  const activeHandle = activeProfile?.username ? `@${activeProfile.username}` : "Parapost Network member";
  const inputDisabled =
    loadingInbox || sending || !activeConversationId || !activeConversationIsAcceptedFriend || !!errorMessage;
  const sendDisabled = (!messageText.trim() && !selectedImage) || inputDisabled || compressingImage;

  return (
    <div
      className={mobileChatOpen ? "parachat-page-root parachat-page-chat-open" : "parachat-page-root"}
      style={pageStyle}
    >
      <style>{`
        @media (max-width: 980px) {
          .parachat-page-root {
            min-height: 100svh !important;
            min-height: 100dvh !important;
            overflow-x: hidden !important;
          }

          .parachat-page-chat-open {
            height: 100svh !important;
            height: 100dvh !important;
            max-height: 100svh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }

          .parachat-shell {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
            padding: 0 !important;
            min-height: 100svh !important;
            min-height: 100dvh !important;
            max-width: none !important;
          }

          .parachat-page-chat-open .parachat-shell {
            height: 100svh !important;
            height: 100dvh !important;
            max-height: 100svh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }

          .parachat-inbox {
            display: block !important;
            border-radius: 0 !important;
            min-height: 100svh !important;
            min-height: 100dvh !important;
            max-height: none !important;
            border: none !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .parachat-panel {
            display: none !important;
            border-radius: 0 !important;
            min-height: 100svh !important;
            min-height: 100dvh !important;
            border: none !important;
          }

          .parachat-mobile-chat-open .parachat-inbox {
            display: none !important;
          }

          .parachat-mobile-chat-open .parachat-panel {
            display: grid !important;
            grid-template-rows: auto minmax(0, 1fr) auto !important;
            height: 100svh !important;
            height: 100dvh !important;
            min-height: 100svh !important;
            min-height: 100dvh !important;
            max-height: 100svh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }

          .parachat-mobile-chat-open .parachat-messages {
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding-bottom: 18px !important;
          }

          .parachat-mobile-chat-open .parachat-composer {
            position: sticky !important;
            bottom: 0 !important;
            z-index: 80 !important;
            flex-shrink: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 9px 10px calc(18px + env(safe-area-inset-bottom)) !important;
            background: rgba(3,7,18,0.99) !important;
            box-shadow: 0 -18px 34px rgba(0,0,0,0.42) !important;
          }

          .parachat-mobile-chat-open .parachat-composer-row {
            align-items: center !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .parachat-mobile-chat-open .parachat-composer textarea {
            height: 46px !important;
            min-height: 46px !important;
            max-height: 92px !important;
            box-sizing: border-box !important;
            line-height: 1.25 !important;
            overflow-y: auto !important;
          }

          .parachat-desktop-only {
            display: none !important;
          }

          .parachat-mobile-back {
            display: inline-flex !important;
          }

          .parachat-conversation-list {
            max-height: none !important;
            overflow: visible !important;
          }
        }

        @media (min-width: 981px) {
          .parachat-mobile-back {
            display: none !important;
          }
        }


          .parachat-conversation-list {
            max-height: none !important;
            overflow: visible !important;
            scrollbar-width: none !important;
          }

          .parachat-conversation-list::-webkit-scrollbar {
            display: none !important;
          }


        @media (max-width: 640px) {
          .parachat-title {
            font-size: 25px !important;
          }

          .parachat-panel {
            grid-template-rows: auto minmax(0, 1fr) auto !important;
          }

          .parachat-messages {
            padding: 14px !important;
          }

          .parachat-composer {
            gap: 8px !important;
            padding: 9px 10px calc(18px + env(safe-area-inset-bottom)) !important;
          }

          .parachat-composer-row {
            gap: 8px !important;
            align-items: center !important;
          }

          .parachat-image-button {
            width: 44px !important;
            min-width: 44px !important;
            height: 44px !important;
            padding: 0 !important;
          }

          .parachat-image-preview {
            max-width: 100% !important;
          }

          .parachat-composer textarea {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            height: 46px !important;
            min-height: 46px !important;
            max-height: 92px !important;
            font-size: 16px !important;
            line-height: 1.25 !important;
            padding: 12px 13px !important;
          }

          .parachat-composer button[type="submit"] {
            min-width: 74px !important;
            min-height: 46px !important;
            padding: 0 14px !important;
            font-size: 14px !important;
            white-space: nowrap !important;
          }
        }
      `}</style>

      <div
        className={`parachat-shell ${mobileChatOpen ? "parachat-mobile-chat-open" : ""}`}
        style={shellStyle}
      >
        <aside className="parachat-inbox" style={inboxStyle}>
          <div style={inboxHeaderStyle}>
            <Link href="/dashboard" style={backLinkStyle}>
              ← Feed
            </Link>

            <div style={{ textAlign: "right" }}>
              <div style={brandTitleStyle}>PARAPOST</div>
              <div style={brandSubtitleStyle}>PARACHAT</div>
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={heroIconStyle}>💬</div>
            <div style={{ minWidth: 0 }}>
              <h1 className="parachat-title" style={inboxTitleStyle}>Parachat</h1>
              <p style={inboxSubtitleStyle}>
                Private and secure direct messages for Parapost Network. Your chats are designed to stay between you and the people you message.
              </p>
            </div>

            {totalUnreadCount > 0 ? (
              <span style={totalBadgeStyle}>{totalUnreadCount}</span>
            ) : null}
          </div>

          <div style={statusStripStyle}>
            <span style={statusDotStyle} />
            <span>
              {totalUnreadCount > 0
                ? `${totalUnreadCount} unread message${totalUnreadCount === 1 ? "" : "s"}`
                : "All caught up"}
            </span>
          </div>

          {statusMessage ? (
            <div style={statusMessageStyle}>
              <span style={successDotStyle} />
              {statusMessage}
            </div>
          ) : null}

          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search Parachat..."
            style={searchInputStyle}
          />

          <div className="parachat-conversation-list" style={conversationListStyle}>
            {loadingInbox ? (
              <div style={conversationEmptyStyle}>Loading Parachat...</div>
            ) : filteredConversations.length === 0 ? (
              <div style={conversationEmptyStyle}>
                No conversations yet. Visit an accepted friend’s profile and click Parachat to start messaging.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const profile = conversation.otherProfile;
                const isActive = conversation.id === activeConversationId;

                return (
                  <div
                    key={conversation.id}
                    style={isActive ? conversationItemActiveStyle : conversationItemStyle}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      style={conversationSelectButtonStyle}
                    >
                      <div style={conversationAvatarWrapStyle}>
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            style={conversationAvatarImageStyle}
                          />
                        ) : (
                          <div style={conversationAvatarFallbackStyle}>
                            {getInitial(profile)}
                          </div>
                        )}

                        {isParachatProfileActuallyOnline(profile) ? <span style={onlineDotStyle} /> : null}
                      </div>

                      <div style={conversationTextStyle}>
                        <div style={conversationTopLineStyle}>
                          <strong style={conversationNameStyle}>
                            {getProfileName(profile)}
                          </strong>

                          <span style={conversationTimeStyle}>
                            {formatMessageTime(conversation.lastMessage?.created_at)}
                          </span>
                        </div>

                        <div style={conversationBottomLineStyle}>
                          <span
                            style={{
                              ...conversationPreviewStyle,
                              color: conversation.unreadCount > 0 ? "#f9fafb" : "#9ca3af",
                              fontWeight: conversation.unreadCount > 0 ? 850 : 500,
                            }}
                          >
                            {getConversationPreviewText(conversation)}
                          </span>

                          {conversation.unreadCount > 0 ? (
                            <span style={unreadBadgeStyle}>{conversation.unreadCount}</span>
                          ) : conversation.isNewFriend ? (
                            <span style={newFriendBadgeStyle}>New friend</span>
                          ) : null}
                        </div>
                      </div>
                    </button>

                    <div style={conversationMenuWrapStyle}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenConversationMenuId((currentId) =>
                            currentId === conversation.id ? null : conversation.id
                          );
                        }}
                        style={conversationMenuButtonStyle}
                        aria-label={`More options for Parachat with ${getProfileName(profile)}`}
                      >
                        ⋯
                      </button>

                      {openConversationMenuId === conversation.id ? (
                        <div
                          style={conversationMenuStyle}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDeleteConversation(conversation)}
                            disabled={deletingConversationId === conversation.id}
                            style={conversationDeleteButtonStyle}
                          >
                            {deletingConversationId === conversation.id
                              ? "Deleting..."
                              : "Delete conversation"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="parachat-panel" style={chatPanelStyle}>
          {!activeConversationId ? (
            <div style={selectConversationStyle}>
              <div style={emptyIconStyle}>💬</div>
              <strong>Select a Parachat</strong>
              <span>Choose someone from the left to start messaging.</span>
            </div>
          ) : (
            <>
              <header style={chatHeaderStyle}>
                <div style={headerLeftStyle}>
                  <button
                    type="button"
                    className="parachat-mobile-back"
                    onClick={handleMobileBackToInbox}
                    style={mobileBackButtonStyle}
                    aria-label="Back to Parachat inbox"
                  >
                    ←
                  </button>

                  <div style={avatarWrapStyle}>
                    {activeProfile?.avatar_url ? (
                      <img src={activeProfile.avatar_url} alt="" style={avatarImageStyle} />
                    ) : (
                      <div style={avatarFallbackStyle}>{getInitial(activeProfile)}</div>
                    )}

                    {isParachatProfileActuallyOnline(activeProfile) ? <span style={onlineDotStyle} /> : null}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h2 style={headerTitleStyle}>{activeName}</h2>
                    <div style={headerSubtitleStyle}>
                      {activeConversationIsAcceptedFriend
                        ? isParachatProfileActuallyOnline(activeProfile)
                          ? "Online now"
                          : activeHandle
                        : "Parachat requires accepted friendship"}
                    </div>
                  </div>
                </div>

                <div style={headerActionsStyle}>
                  {activeConversation?.otherUserId ? (
                    <Link
                      href={`/profile/${activeConversation.otherUserId}`}
                      style={profileButtonStyle}
                    >
                      Profile
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCloseActiveConversation}
                    style={closeChatButtonStyle}
                    aria-label="Close this Parachat"
                    title="Close Parachat"
                  >
                    ×
                  </button>
                </div>
              </header>

              <section ref={messagesAreaRef} className="parachat-messages" style={messagesAreaStyle}>
                {errorMessage ? (
                  <div style={errorBoxStyle}>
                    <strong>Parachat needs attention</strong>
                    <span>{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() =>
                        activeConversationId && viewerId
                          ? loadMessages(activeConversationId, viewerId)
                          : loadInbox()
                      }
                      style={retryButtonStyle}
                    >
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <div style={emptyIconStyle}>👋</div>
                    <strong>No messages yet</strong>
                    <span>
                      {activeConversation?.isNewFriend
                        ? `${activeName} is now your friend. Send the first Parachat when you are ready.`
                        : `Start the Parachat with ${activeName}.`}
                    </span>
                  </div>
                ) : (
                  <div style={messageStackStyle}>
                    {groupedMessages.map((group) => (
                      <div key={group.label} style={messageGroupStyle}>
                        <div style={dateDividerStyle}>
                          <span>{group.label}</span>
                        </div>

                        {group.items.map((message) => {
                          const isMine = message.sender_id === viewerId;

                          return (
                            <div
                              key={message.id}
                              style={{
                                ...messageRowStyle,
                                justifyContent: isMine ? "flex-end" : "flex-start",
                              }}
                            >
                              {!isMine ? (
                                <div style={smallAvatarStyle}>
                                  {activeProfile?.avatar_url ? (
                                    <img
                                      src={activeProfile.avatar_url}
                                      alt=""
                                      style={smallAvatarImageStyle}
                                    />
                                  ) : (
                                    <span>{getInitial(activeProfile)}</span>
                                  )}
                                </div>
                              ) : null}

                              <div
                                style={{
                                  ...bubbleWrapStyle,
                                  alignItems: isMine ? "flex-end" : "flex-start",
                                }}
                              >
                                <div style={isMine ? myBubbleStyle : theirBubbleStyle}>
                                  {isImageMessage(message) ? (
                                    <div style={messageImageBlockStyle}>
                                      {message.signedImageUrl ? (
                                        <img
                                          src={message.signedImageUrl}
                                          alt={message.body || "Parachat image"}
                                          style={messageImageStyle}
                                          onClick={() => handleOpenImageViewer(message, isMine)}
                                          onLoad={() => scrollToBottom("auto")}
                                          title="Open photo"
                                        />
                                      ) : (
                                        <div style={messageImageMissingStyle}>
                                          Image preview unavailable
                                        </div>
                                      )}

                                      {message.body ? (
                                        <div style={messageImageCaptionStyle}>{message.body}</div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    message.body
                                  )}
                                </div>

                                <div style={messageTimeStyle}>
                                  {formatMessageTime(message.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </section>

              <form className="parachat-composer" onSubmit={handleSubmit} style={composerShellStyle}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleSelectImage}
                  style={{ display: "none" }}
                />

                {selectedImage || imageError || compressingImage ? (
                  <div className="parachat-image-preview" style={imagePreviewShellStyle}>
                    {selectedImage ? (
                      <div style={imagePreviewContentStyle}>
                        <img
                          src={selectedImage.previewUrl}
                          alt="Selected Parachat upload"
                          style={imagePreviewStyle}
                        />

                        <div style={imagePreviewTextStyle}>
                          <strong>Photo ready</strong>
                          <span>
                            Compressed to {(selectedImage.sizeBytes / 1024).toFixed(0)} KB
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={clearSelectedImage}
                          style={imageRemoveButtonStyle}
                          aria-label="Remove selected photo"
                        >
                          Remove
                        </button>
                      </div>
                    ) : compressingImage ? (
                      <div style={imageHelperTextStyle}>Compressing photo...</div>
                    ) : imageError ? (
                      <div style={imageErrorTextStyle}>{imageError}</div>
                    ) : null}
                  </div>
                ) : null}

                <div className="parachat-composer-row" style={composerRowStyle}>
                  <button
                    type="button"
                    className="parachat-image-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={inputDisabled || compressingImage}
                    style={{
                      ...imageButtonStyle,
                      opacity: inputDisabled || compressingImage ? 0.55 : 1,
                      cursor: inputDisabled || compressingImage ? "not-allowed" : "pointer",
                    }}
                    aria-label="Add a photo to this Parachat"
                    title="Add photo"
                  >
                    +
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={handleTextChange}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={
                      activeConversationIsAcceptedFriend
                        ? selectedImage
                          ? "Add a caption..."
                          : "Message..."
                        : "Friends only"
                    }
                    rows={1}
                    style={composerInputStyle}
                    disabled={inputDisabled}
                  />

                  <button
                    type="submit"
                    disabled={sendDisabled}
                    style={{
                      ...sendButtonStyle,
                      opacity: sendDisabled ? 0.55 : 1,
                      cursor: sendDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {sending ? "Sending..." : selectedImage ? "Send Photo" : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>

      {imageViewer ? (
        <div
          style={imageViewerOverlayStyle}
          onClick={handleCloseImageViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Parachat photo viewer"
        >
          <div style={imageViewerShellStyle} onClick={(event) => event.stopPropagation()}>
            <div style={imageViewerTopBarStyle}>
              <div style={imageViewerMetaStyle}>
                <strong>{imageViewer.senderName}</strong>
                <span>{imageViewer.timeLabel}</span>
              </div>

              <button
                type="button"
                onClick={handleCloseImageViewer}
                style={imageViewerCloseButtonStyle}
                aria-label="Close photo viewer"
              >
                ×
              </button>
            </div>

            <img
              src={imageViewer.url}
              alt={imageViewer.alt}
              style={imageViewerImageStyle}
            />

            {imageViewer.caption ? (
              <div style={imageViewerCaptionStyle}>{imageViewer.caption}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(168,85,247,0.30), transparent 34%), radial-gradient(circle at bottom right, rgba(34,211,238,0.12), transparent 30%), radial-gradient(circle at 50% 0%, rgba(236,72,153,0.10), transparent 28%), #05070a",
  color: "#f9fafb",
};

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1600px",
  margin: "0 auto",
  padding: "18px",
  display: "grid",
  gridTemplateColumns: "400px minmax(0, 1fr)",
  gap: "18px",
};

const inboxStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 36px)",
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(7,10,16,0.94))",
  borderRadius: "30px",
  padding: "16px",
  boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
  overflow: "hidden",
  backdropFilter: "blur(18px)",
};

const inboxHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "14px",
};

const backLinkStyle: React.CSSProperties = {
  color: "#d8b4fe",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: "13px",
};

const brandTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 950,
  letterSpacing: "-0.04em",
};

const brandSubtitleStyle: React.CSSProperties = {
  color: "#a855f7",
  fontSize: "10px",
  letterSpacing: "0.28em",
  fontWeight: 900,
};

const heroCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
  padding: "14px",
  borderRadius: "24px",
  border: "1px solid rgba(168,85,247,0.28)",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(255,255,255,0.055))",
  marginBottom: "12px",
};

const heroIconStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "18px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
  boxShadow: "0 14px 34px rgba(168,85,247,0.30)",
  fontSize: "22px",
};

const inboxTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
  fontWeight: 950,
  letterSpacing: "-0.06em",
};

const inboxSubtitleStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#9ca3af",
  fontSize: "13px",
};

const totalBadgeStyle: React.CSSProperties = {
  minWidth: "30px",
  height: "30px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #ec4899, #a855f7)",
  color: "#ffffff",
  fontWeight: 950,
  boxShadow: "0 10px 28px rgba(168,85,247,0.35)",
};

const statusStripStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#d1d5db",
  fontSize: "12px",
  fontWeight: 800,
  padding: "8px 10px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  marginBottom: "12px",
};

const statusDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 18px rgba(34,197,94,0.60)",
};

const statusMessageStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#d1fae5",
  fontSize: "12px",
  fontWeight: 850,
  padding: "9px 11px",
  borderRadius: "16px",
  border: "1px solid rgba(34,197,94,0.22)",
  background: "rgba(34,197,94,0.09)",
  marginBottom: "12px",
};

const successDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 14px rgba(34,197,94,0.60)",
  flexShrink: 0,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "46px",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.065)",
  color: "#ffffff",
  outline: "none",
  padding: "0 14px",
  marginBottom: "14px",
};

const conversationListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "none",
  overflow: "visible",
  paddingRight: 0,
};

const conversationEmptyStyle: React.CSSProperties = {
  color: "#9ca3af",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  borderRadius: "18px",
  padding: "16px",
  lineHeight: 1.5,
};

const conversationItemStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
  color: "#f9fafb",
  borderRadius: "20px",
  padding: "11px",
  display: "flex",
  alignItems: "center",
  gap: "11px",
  cursor: "pointer",
  textAlign: "left",
  transition: "transform 160ms ease, border-color 160ms ease, background 160ms ease",
};

const conversationItemActiveStyle: React.CSSProperties = {
  ...conversationItemStyle,
  border: "1px solid rgba(168,85,247,0.55)",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.24), rgba(255,255,255,0.065))",
  boxShadow: "0 14px 38px rgba(0,0,0,0.30)",
};

const conversationSelectButtonStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  border: 0,
  background: "transparent",
  color: "inherit",
  padding: 0,
  display: "flex",
  alignItems: "center",
  gap: "11px",
  textAlign: "left",
  cursor: "pointer",
};

const conversationMenuWrapStyle: React.CSSProperties = {
  position: "relative",
  flexShrink: 0,
  alignSelf: "center",
};

const conversationMenuButtonStyle: React.CSSProperties = {
  width: "26px",
  height: "26px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#d1d5db",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: "15px",
  lineHeight: 1,
  fontWeight: 950,
};

const conversationMenuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "30px",
  zIndex: 40,
  minWidth: "150px",
  borderRadius: "13px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(7,10,16,0.98)",
  boxShadow: "0 14px 34px rgba(0,0,0,0.44)",
  padding: "6px",
  backdropFilter: "blur(16px)",
};

const conversationDeleteButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(248,113,113,0.20)",
  background: "rgba(248,113,113,0.10)",
  color: "#fecaca",
  borderRadius: "10px",
  padding: "7px 9px",
  textAlign: "left",
  fontWeight: 900,
  fontSize: "11px",
  cursor: "pointer",
};

const conversationAvatarWrapStyle: React.CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  position: "relative",
  flexShrink: 0,
  border: "2px solid rgba(168,85,247,0.72)",
  padding: "2px",
  background: "#05070a",
  overflow: "visible",
  isolation: "isolate",
};

const conversationAvatarImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
};

const conversationAvatarFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  background: "linear-gradient(135deg, #7c3aed, #111827)",
};

const onlineDotStyle: React.CSSProperties = {
  position: "absolute",
  right: "-1px",
  bottom: "-1px",
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  background: "#22c55e",
  border: "2px solid #05070a",
  boxShadow: "0 0 10px rgba(34,197,94,0.65)",
  zIndex: 5,
  pointerEvents: "none",
};

const conversationTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const conversationTopLineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const conversationNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "14px",
};

const conversationTimeStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: 800,
  flexShrink: 0,
};

const conversationBottomLineStyle: React.CSSProperties = {
  marginTop: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const conversationPreviewStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const unreadBadgeStyle: React.CSSProperties = {
  minWidth: "21px",
  height: "21px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #ec4899, #a855f7)",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 950,
};

const newFriendBadgeStyle: React.CSSProperties = {
  minHeight: "21px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(168,85,247,0.16)",
  border: "1px solid rgba(168,85,247,0.28)",
  color: "#f5d0fe",
  fontSize: "10px",
  fontWeight: 950,
  padding: "0 7px",
  whiteSpace: "nowrap",
};

const chatPanelStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 36px)",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(7,10,16,0.90)",
  borderRadius: "30px",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "86px minmax(0, 1fr) auto",
  boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
  backdropFilter: "blur(18px)",
};

const selectConversationStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 36px)",
  display: "grid",
  placeItems: "center",
  color: "#9ca3af",
  textAlign: "center",
  gap: "8px",
};

const emptyIconStyle: React.CSSProperties = {
  width: "62px",
  height: "62px",
  borderRadius: "22px",
  display: "grid",
  placeItems: "center",
  background: "rgba(168,85,247,0.16)",
  border: "1px solid rgba(168,85,247,0.24)",
  fontSize: "26px",
  margin: "0 auto 6px",
};

const chatHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  padding: "14px 18px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(135deg, rgba(17,24,39,0.96), rgba(88,28,135,0.34), rgba(8,12,18,0.96))",
};

const headerLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

const mobileBackButtonStyle: React.CSSProperties = {
  display: "none",
  width: "38px",
  height: "38px",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#ffffff",
  fontSize: "18px",
  cursor: "pointer",
  flexShrink: 0,
};

const avatarWrapStyle: React.CSSProperties = {
  width: "54px",
  height: "54px",
  borderRadius: "50%",
  position: "relative",
  border: "2px solid rgba(168,85,247,0.82)",
  padding: "2px",
  background: "#090b12",
  flexShrink: 0,
  overflow: "visible",
  isolation: "isolate",
};

const avatarImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
};

const avatarFallbackStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  background: "linear-gradient(135deg, #7c3aed, #111827)",
};

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "19px",
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const headerSubtitleStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  marginTop: "3px",
};

const profileButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#f9fafb",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "999px",
  padding: "9px 13px",
  fontWeight: 900,
  fontSize: "13px",
  flexShrink: 0,
};

const closeChatButtonStyle: React.CSSProperties = {
  width: "38px",
  height: "38px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.075)",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "22px",
  lineHeight: 1,
  fontWeight: 950,
  cursor: "pointer",
  flexShrink: 0,
};

const messagesAreaStyle: React.CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: "18px",
};

const emptyStateStyle: React.CSSProperties = {
  minHeight: "100%",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  gap: "7px",
  color: "#9ca3af",
};

const errorBoxStyle: React.CSSProperties = {
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.22)",
  color: "#fecaca",
  borderRadius: "18px",
  padding: "14px",
  fontWeight: 800,
  display: "grid",
  gap: "8px",
  alignContent: "start",
};

const retryButtonStyle: React.CSSProperties = {
  width: "fit-content",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const messageStackStyle: React.CSSProperties = {
  display: "grid",
  gap: "18px",
};

const messageGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const dateDividerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  margin: "6px 0",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 800,
};

const messageRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "8px",
};

const smallAvatarStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  background: "rgba(255,255,255,0.07)",
  display: "grid",
  placeItems: "center",
  color: "#f9fafb",
  fontSize: "12px",
  fontWeight: 900,
  flexShrink: 0,
  overflow: "hidden",
};

const smallAvatarImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const bubbleWrapStyle: React.CSSProperties = {
  maxWidth: "min(700px, 78%)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const myBubbleStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #9333ea, #7c3aed)",
  color: "#ffffff",
  borderRadius: "20px 20px 6px 20px",
  padding: "11px 14px",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  boxShadow: "0 12px 30px rgba(124,58,237,0.24)",
};

const theirBubbleStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.075)",
  color: "#f9fafb",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "20px 20px 20px 6px",
  padding: "11px 14px",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const messageImageBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const messageImageStyle: React.CSSProperties = {
  display: "block",
  width: "min(320px, 70vw)",
  maxHeight: "420px",
  objectFit: "cover",
  cursor: "zoom-in",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.14)",
};

const messageImageMissingStyle: React.CSSProperties = {
  width: "min(320px, 70vw)",
  minHeight: "170px",
  borderRadius: "16px",
  display: "grid",
  placeItems: "center",
  color: "#cbd5e1",
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontWeight: 850,
};

const messageImageCaptionStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const messageTimeStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: 700,
  padding: "0 4px",
};

const imageViewerOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "grid",
  placeItems: "center",
  padding: "clamp(14px, 4vw, 34px)",
  background: "rgba(3,7,18,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const imageViewerShellStyle: React.CSSProperties = {
  width: "min(980px, 100%)",
  maxHeight: "calc(100dvh - 28px)",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: "12px",
  borderRadius: "26px",
  border: "1px solid rgba(168,85,247,0.32)",
  background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(3,7,18,0.98))",
  boxShadow: "0 28px 90px rgba(0,0,0,0.55), 0 0 44px rgba(168,85,247,0.24)",
  padding: "12px",
  overflow: "hidden",
};

const imageViewerTopBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "4px 4px 0",
};

const imageViewerMetaStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: "2px",
  color: "#f9fafb",
  fontSize: "14px",
};

const imageViewerCloseButtonStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontSize: "24px",
  lineHeight: 1,
  fontWeight: 900,
  cursor: "pointer",
  flexShrink: 0,
};

const imageViewerImageStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  maxHeight: "calc(100dvh - 150px)",
  objectFit: "contain",
  borderRadius: "20px",
  background: "rgba(0,0,0,0.34)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const imageViewerCaptionStyle: React.CSSProperties = {
  color: "#e5e7eb",
  fontSize: "14px",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: "0 4px 3px",
};

const composerShellStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  borderTop: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(3,7,18,0.92)",
};

const composerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  minWidth: 0,
};

const imageButtonStyle: React.CSSProperties = {
  width: "44px",
  minWidth: "44px",
  height: "44px",
  borderRadius: "999px",
  border: "1px solid rgba(168,85,247,0.45)",
  background: "rgba(168,85,247,0.14)",
  color: "#f5d0fe",
  fontSize: "24px",
  lineHeight: 1,
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
};

const imagePreviewShellStyle: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.24)",
  background: "rgba(168,85,247,0.10)",
  borderRadius: "18px",
  padding: "9px",
};

const imagePreviewContentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
};

const imagePreviewStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "14px",
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid rgba(255,255,255,0.14)",
};

const imagePreviewTextStyle: React.CSSProperties = {
  display: "grid",
  gap: "3px",
  minWidth: 0,
  color: "#f9fafb",
  fontSize: "12px",
};

const imageRemoveButtonStyle: React.CSSProperties = {
  marginLeft: "auto",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "8px 10px",
  fontWeight: 900,
  fontSize: "12px",
  cursor: "pointer",
};

const imageHelperTextStyle: React.CSSProperties = {
  color: "#ddd6fe",
  fontSize: "13px",
  fontWeight: 850,
};

const imageErrorTextStyle: React.CSSProperties = {
  color: "#fecaca",
  fontSize: "13px",
  fontWeight: 850,
};

const composerInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  minHeight: "44px",
  maxHeight: "130px",
  resize: "none",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.065)",
  color: "#ffffff",
  outline: "none",
  padding: "12px 14px",
  lineHeight: 1.45,
  fontSize: "14px",
};

const sendButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  minHeight: "44px",
  borderRadius: "999px",
  border: "1px solid rgba(168,85,247,0.55)",
  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
  color: "#ffffff",
  padding: "0 18px",
  fontWeight: 950,
};

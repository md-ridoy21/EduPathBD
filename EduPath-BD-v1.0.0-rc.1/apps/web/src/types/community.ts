export type Discussion = { id: string; institutionId: string; title: string; body: string; createdAt: string };

export type CommunityComment = {
  id: string;
  postId: string;
  parentId?: string;
  body: string;
  isVerified: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string; role: "STUDENT" | "MODERATOR" | "ADMIN" };
  likes: number;
  dislikes: number;
  userVote?: "LIKE" | "DISLIKE";
};

export type VoteUpdate = { commentId: string; postId: string; likes: number; dislikes: number; userVote?: "LIKE" | "DISLIKE" };
export type RatingSummary = { average: number; count: number; distribution: Record<string, number>; userScore?: number };

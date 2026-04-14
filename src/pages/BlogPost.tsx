import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronLeft, Calendar, User } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type BlogPostDetail = {
  id: string;
  title: string;
  content: string;
  author: string;
  cover_image_url: string;
  published_at: string;
};

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      const supabase = getSupabaseClient();
      if (!supabase || !slug) return;

      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (!error && data) setPost(data);
      setLoading(false);
    }
    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <Skeleton className="h-6 w-24 mb-8" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-4 w-1/2 mb-8" />
        <Skeleton className="aspect-video w-full rounded-2xl mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
        <p className="text-muted-foreground mb-8">The post you're looking for doesn't exist or has been removed.</p>
        <Link to="/blog">
          <Button variant="outline">Back to Blog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to blog
        </Link>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-6 leading-tight">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>By {post.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(post.published_at), "MMMM dd, yyyy")}</span>
          </div>
        </div>
      </div>

      {/* Cover Image */}
      <div className="container mx-auto px-4 max-w-5xl mb-12">
        <div className="aspect-video rounded-3xl overflow-hidden shadow-xl border border-border">
          <img 
            src={post.cover_image_url || "/placeholder.svg"} 
            alt={post.title} 
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <article className="container mx-auto px-4 max-w-3xl prose prose-slate md:prose-lg prose-primary prose-headings:font-extrabold prose-p:text-muted-foreground prose-p:leading-relaxed">
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      {/* Footer Share/Next */}
      <div className="container mx-auto px-4 max-w-3xl mt-20 pt-12 border-t text-center">
        <h3 className="text-lg font-bold mb-6">Enjoyed this post?</h3>
        <Link to="/blog">
          <Button variant="outline" className="rounded-xl px-8">Browse more from our team</Button>
        </Link>
      </div>
    </div>
  );
}

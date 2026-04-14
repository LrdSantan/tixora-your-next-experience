import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  cover_image_url: string;
  published_at: string;
};

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, author, cover_image_url, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (!error && data) setPosts(data);
      setLoading(false);
    }
    fetchPosts();
  }, []);

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Tixora Blog</h1>
        <p className="text-muted-foreground text-lg">Insights, updates, and more from the Tixora team.</p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
          <p className="text-muted-foreground">No posts yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="group flex flex-col h-full bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={post.cover_image_url || "/placeholder.svg"} 
                  alt={post.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="text-xs text-muted-foreground mb-3">
                  {format(new Date(post.published_at), "MMMM dd, yyyy")}
                </p>
                <h2 className="text-xl font-bold mb-3 line-clamp-2 transition-colors group-hover:text-primary">
                  {post.title}
                </h2>
                <p className="text-muted-foreground text-sm line-clamp-3 mb-6">
                  {post.excerpt}
                </p>
                <div className="mt-auto pt-4 border-t flex items-center justify-between text-xs font-medium uppercase tracking-wider">
                  <span className="text-muted-foreground">By {post.author}</span>
                  <span className="text-primary group-hover:underline">Read More</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

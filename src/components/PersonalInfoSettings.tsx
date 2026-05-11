import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, UserCircle, Upload, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function PersonalInfoSettings() {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    bio: "",
    avatarUrl: "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !user) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, phone, bio, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setFormData({
            fullName: data.full_name || "",
            phone: data.phone || "",
            bio: data.bio || "",
            avatarUrl: data.avatar_url || "",
          });
        }
      } catch (err: any) {
        toast.error("Failed to load profile details");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [supabase, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      toast.success("Photo uploaded!");
    } catch (err: any) {
      toast.error("Failed to upload photo. Ensure 'avatars' bucket exists.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          phone: formData.phone,
          bio: formData.bio,
          avatar_url: formData.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-full bg-primary/10 text-primary">
          <UserCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Personal Information</h2>
          <p className="text-sm text-muted-foreground">Update your public profile and contact details.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Photo */}
        <div className="flex flex-col items-center sm:flex-row gap-6 p-4 rounded-xl bg-muted/30 border border-border">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background bg-muted flex items-center justify-center shadow-md">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-12 h-12 text-muted-foreground opacity-30" />
              )}
            </div>
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <h4 className="font-semibold text-sm">Profile Photo</h4>
            <p className="text-xs text-muted-foreground mb-3">Recommended: Square image, max 2MB.</p>
            <div className="flex justify-center sm:justify-start">
              <label className="cursor-pointer">
                <Input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted transition-all text-sm font-medium">
                  <Upload className="w-3.5 h-3.5" />
                  {isUploading ? "Uploading..." : "Change Photo"}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              placeholder="Your full name"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. 08012345678"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="bio">Bio</Label>
            <span className={cn("text-[10px] font-medium", formData.bio.length > 150 ? "text-red-500" : "text-muted-foreground")}>
              {formData.bio.length}/160
            </span>
          </div>
          <Textarea
            id="bio"
            placeholder="Tell us a bit about yourself..."
            className="min-h-[100px] resize-none"
            maxLength={160}
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-[#1A7A4A] hover:bg-[#1A7A4A]/90 text-white"
          disabled={isSaving || isUploading}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

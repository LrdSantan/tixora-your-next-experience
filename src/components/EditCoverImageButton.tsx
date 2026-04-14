import { useState, useRef } from "react";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

interface EditCoverImageButtonProps {
  eventId: string;
  onSuccess: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

export function EditCoverImageButton({
  eventId,
  onSuccess,
  variant = "outline",
  className = "",
  size = "sm",
  label = "Edit Cover Image",
}: EditCoverImageButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabase) {
      toast.error("Database connection missing.");
      return;
    }

    try {
      setIsUpdating(true);

      // 1. Upload new image
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Update event record (both columns to be safe)
      const { error: updateError } = await supabase
        .from("events")
        .update({
          cover_image_url: publicUrl,
          banner_url: publicUrl,
        })
        .eq("id", eventId);

      if (updateError) throw updateError;

      toast.success("Cover image updated successfully");
      onSuccess();
    } catch (err: any) {
      console.error("[EditCoverImage Error]", err);
      toast.error(err.message || "Failed to update cover image");
    } finally {
      setIsUpdating(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={isUpdating}
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={isUpdating}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        {isUpdating ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : size === "icon" ? (
          <ImageIcon className="w-4 h-4" />
        ) : (
          <Upload className="w-3.5 h-3.5 mr-2" />
        )}
        {size !== "icon" && (isUpdating ? "Updating..." : label)}
      </Button>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceHttps } from "@otter-music/shared";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { ensurePermission, triggerBlobDownload } from "@/lib/utils/download";
import { blobToBase64 } from "@/lib/utils/base64";
import { useExitLayer } from "@/hooks/useExitLayer";
import toast from "react-hot-toast";

interface MusicCoverProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: React.ReactNode;
  previewable?: boolean;
}

// 迁移标记，防止重复迁移
let pictureMigrationDone = false;

export function MusicCover({
  src,
  alt = "Cover",
  className,
  iconClassName,
  fallbackIcon,
  previewable = false,
}: MusicCoverProps) {
  const [error, setError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { push, pop } = useExitLayer();
  const coverUrl = forceHttps(src);

  // src 变化时重置错误状态，让新的封面 URL 有机会重新加载
  useEffect(() => {
    setError(false);
  }, [src]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const id = push({ close: () => setIsPreviewOpen(false) });
    return () => {
      pop(id);
    };
  }, [isPreviewOpen, push, pop]);

  const migratePictures = async () => {
    if (pictureMigrationDone) return;
    pictureMigrationDone = true;

    const OLD_DIR = "Pictures/OtterMusic";
    const NEW_DIR = "Pictures/QingtingMusic";

    try {
      // 尝试读取旧目录下文件并迁移到新目录
      const oldList = await Filesystem.readdir({
        path: OLD_DIR,
        directory: Directory.ExternalStorage,
      }).catch(() => ({ files: [], directories: [] } as any));

      if (!oldList || !oldList.files || oldList.files.length === 0) return;

      // 确保新目录存在（通过写入空文件方式创建目录）
      await Filesystem.mkdir({
        path: NEW_DIR,
        directory: Directory.ExternalStorage,
        recursive: true,
      }).catch(() => {});

      for (const file of oldList.files) {
        try {
          const oldPath = `${OLD_DIR}/${file}`;
          const newPath = `${NEW_DIR}/${file}`;
          const data = await Filesystem.readFile({
            path: oldPath,
            directory: Directory.ExternalStorage,
          });
          await Filesystem.writeFile({
            path: newPath,
            data: data.data,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          // 删除旧文件（忽略错误）
          await Filesystem.deleteFile({
            path: oldPath,
            directory: Directory.ExternalStorage,
          }).catch(() => {});
        } catch (e) {
          // 单个文件迁移失败继续下一个
          console.error("migratePictures file error:", e);
        }
      }
    } catch (e) {
      console.error("migratePictures error:", e);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!coverUrl || isSaving) return;
    setIsSaving(true);

    try {
      const filename = `${alt.replace(/[\\/:*?"<>|]/g, "_")}.jpg`;

      if (Capacitor.isNativePlatform()) {
        await ensurePermission();

        // 在写入前尝试执行一次迁移（首次触发）
        await migratePictures();

        const response = await fetch(coverUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        const NEW_PATH = `Pictures/QingtingMusic/${filename}`;
        const OLD_PATH = `Pictures/OtterMusic/${filename}`;

        // 优先写入新位置；若失败则回退写入旧位置以保证用户能保存成功
        try {
          await Filesystem.writeFile({
            path: NEW_PATH,
            data: base64,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          toast.success(`已保存到 ${NEW_PATH}`);
        } catch (e) {
          console.warn("write to new path failed, fallback to old path", e);
          await Filesystem.mkdir({
            path: "Pictures/OtterMusic",
            directory: Directory.ExternalStorage,
            recursive: true,
          }).catch(() => {});
          await Filesystem.writeFile({
            path: OLD_PATH,
            data: base64,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          toast.success(`已保存到 Pictures/OtterMusic`);
        }
      } else {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        triggerBlobDownload(blob, filename);
      }
    } catch (e) {
      console.error(e);
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  if (!src || error) {
    return (
      <div
        className={cn(
          "w-full h-full bg-muted flex items-center justify-center shrink-0",
          className
        )}
      >
        {fallbackIcon || (
          <Music2 className={cn("text-muted-foreground/50", iconClassName)} />
        )}
      </div>
    );
  }

  return (
    <>
      <img
        src={coverUrl}
        alt={alt}
        className={cn(
          "w-full h-full object-cover shrink-0",
          previewable && "cursor-pointer",
          className
        )}
        draggable={false}
        onError={() => setError(true)}
        onClick={() => previewable && setIsPreviewOpen(true)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {previewable &&
        isPreviewOpen &&
        createPortal(
          <div
            data-testid="cover-preview-portal"
            className="fixed inset-0 z-500 flex flex-col items-center justify-center bg-black select-none animate-in fade-in duration-200"
            onClick={() => setIsPreviewOpen(false)}
          >
            <img
              src={coverUrl}
              alt={alt}
              className="max-w-full max-h-[80vh] object-contain pointer-events-none"
            />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="absolute bottom-5 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors border border-white/10 disabled:opacity-50"
            >
              <Download size={16} />
              {isSaving ? "保存中..." : "保存图片"}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

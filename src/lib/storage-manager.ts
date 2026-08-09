import { MusicTrack } from "@/types/music";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { AudioFormat } from "@otter-music/shared";

/**
 * 统一存储配置中心
 */
export const STORAGE_CONFIG = {
  // 根目录名称（保留 BASE_NAME 以兼容旧数据）
  BASE_NAME: "QingtingMusic",
  // 基础路径（相对于根） — 使用英文目录名便于跨平台兼容
  ROOT: "Download/QingtingMusic",
  // 公共目录枚举
  BASE_DIR: Directory.ExternalStorage,
} as const;

/**
 * 集中管理所有业务路径
 */
export const AppPaths = {
  // 音乐文件存放处
  Music: STORAGE_CONFIG.ROOT,

  // 私有数据存放处（如 JSON 记录）
  Data: `${STORAGE_CONFIG.ROOT}/.data`,

  // 缓存存放处（如封面图片等）
  Cache: `${STORAGE_CONFIG.ROOT}/.cache`,

  // 歌单导出存放处
  Playlists: `${STORAGE_CONFIG.ROOT}/Playlists`,

  /**
   * 辅助方法：生成完整的文件路径
   */
  join: (base: string, fileName: string) => `${base}/${fileName}`,
};

export const DOWNLOAD_RECORDS_FILE = "downloads.json";

/**
 * 音频格式 → Blob MIME 映射
 * - mp3 → audio/mpeg
 * - m4a / m4s → audio/mp4 (fMP4)
 * - flv → video/x-flv
 */
export const AUDIO_MIME: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4s: "audio/mp4",
  flv: "video/x-flv",
};

export function buildFileName(track: MusicTrack) {
  const ext = track.audioFormat ?? "mp3";
  return sanitize(
    `${track.name} - ${track.artist?.join(" & ") || "Unknown"}.${ext}`
  );
}

function sanitize(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 获取当前下载目录（优先使用用户自定义目录，否则使用默认目录） */
export function getMusicPath(customDir?: string): string {
  if (customDir) {
    return `${STORAGE_CONFIG.ROOT}/${customDir}`.replace(/\/+/g, "/");
  }
  return AppPaths.Music;
}

// ================= Recursive download migration ===================
// Migrate everything under Download/OtterMusic -> Download/QingtingMusic
const OLD_DOWNLOAD_ROOT = "Download/OtterMusic";
const PROGRESS_KEY = "qingting_download_migration_progress";
let downloadMigrationRunning = false;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function readDirSafe(path: string) {
  return Filesystem.readdir({ path, directory: Directory.ExternalStorage }).catch(
    () => ({ files: [], directories: [] } as any)
  );
}

async function ensureDir(path: string) {
  return Filesystem.mkdir({ path, directory: Directory.ExternalStorage, recursive: true }).catch(() => {});
}

async function copyFile(oldPath: string, newPath: string) {
  try {
    const data = await Filesystem.readFile({ path: oldPath, directory: Directory.ExternalStorage });
    await Filesystem.writeFile({ path: newPath, data: data.data, directory: Directory.ExternalStorage, recursive: true });
    return true;
  } catch (e) {
    console.warn("copyFile failed", oldPath, newPath, e);
    return false;
  }
}

async function deleteFileSafe(path: string) {
  return Filesystem.deleteFile({ path, directory: Directory.ExternalStorage }).catch(() => {});
}

async function migrateDirectory(oldRoot: string, newRoot: string) {
  const stack: Array<{ oldPath: string; newPath: string }> = [];
  // start from root
  stack.push({ oldPath: oldRoot, newPath: newRoot });

  // load progress to resume if present
  const rawProgress = typeof window !== "undefined" ? localStorage.getItem(PROGRESS_KEY) : null;
  const progress = rawProgress ? JSON.parse(rawProgress) : { processed: {} };

  const batchSize = 20; // files per batch

  while (stack.length) {
    const node = stack.pop()!;
    const relOld = node.oldPath;
    const relNew = node.newPath;

    // ensure new directory exists
    await ensureDir(relNew);

    const listing = await readDirSafe(relOld).catch(() => ({ files: [], directories: [] } as any));

    const files: string[] = listing.files || [];
    const dirs: string[] = listing.directories || [];

    // process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      for (const file of batch) {
        const oldPath = `${relOld}/${file}`;
        const newPath = `${relNew}/${file}`;

        // skip if already processed
        if (progress.processed[oldPath]) continue;

        const ok = await copyFile(oldPath, newPath);
        if (ok) {
          // try to delete old file after successful copy
          await deleteFileSafe(oldPath);
          progress.processed[oldPath] = true;
          if (typeof window !== "undefined") localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        }
        // small delay to avoid hogging IO
        await sleep(50);
      }
      // delay between batches
      await sleep(200);
    }

    // push subdirectories onto stack (process depth-first)
    for (const d of dirs.reverse()) {
      const oldSub = `${relOld}/${d}`;
      const newSub = `${relNew}/${d}`;
      stack.push({ oldPath: oldSub, newPath: newSub });
    }
  }
}

export async function migrateDownloadsRecursively() {
  if (downloadMigrationRunning) return;
  downloadMigrationRunning = true;

  try {
    // check if old root exists
    const listing = await readDirSafe(OLD_DOWNLOAD_ROOT).catch(() => ({ files: [], directories: [] } as any));
    if (!listing || (listing.files.length === 0 && listing.directories.length === 0)) return;

    await migrateDirectory(OLD_DOWNLOAD_ROOT, STORAGE_CONFIG.ROOT);
  } catch (e) {
    console.error("migrateDownloadsRecursively error:", e);
  } finally {
    downloadMigrationRunning = false;
  }
}

// trigger on module load (non-blocking)
if (typeof window !== "undefined") {
  // run in a microtask to avoid slowing module evaluation
  void (async () => {
    await sleep(0);
    void migrateDownloadsRecursively();
  })();
}

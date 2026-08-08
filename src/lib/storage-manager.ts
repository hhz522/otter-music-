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

// ========== Download directory migration ===========
// 在模块加载时异步尝试迁移旧的下载目录（Download/OtterMusic）到新的 ROOT
const OLD_DOWNLOAD_ROOT = "Download/OtterMusic";
let downloadMigrationDone = false;

async function migrateDownloadsIfNeeded() {
  if (downloadMigrationDone) return;
  downloadMigrationDone = true;

  try {
    // 读取旧目录下的文件/子目录
    const oldList = await Filesystem.readdir({
      path: OLD_DOWNLOAD_ROOT,
      directory: Directory.ExternalStorage,
    }).catch(() => ({ files: [], directories: [] } as any));

    if (!oldList || (!oldList.files?.length && !oldList.directories?.length)) {
      return;
    }

    // 确保新目录存在
    await Filesystem.mkdir({
      path: STORAGE_CONFIG.ROOT,
      directory: Directory.ExternalStorage,
      recursive: true,
    }).catch(() => {});

    // 迁移文件（仅顶层文件），递归目录可以按需扩展
    for (const file of oldList.files || []) {
      try {
        const oldPath = `${OLD_DOWNLOAD_ROOT}/${file}`;
        const newPath = `${STORAGE_CONFIG.ROOT}/${file}`;
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
        console.warn("migrateDownloads file error:", e);
      }
    }

    // TODO: 选项：迁移子目录（albums / artists folders）——目前略过以降低风险
  } catch (e) {
    console.error("migrateDownloads error:", e);
  }
}

// 异步触发迁移，不阻塞模块导入
void migrateDownloadsIfNeeded();

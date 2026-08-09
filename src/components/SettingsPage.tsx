"use client";

import { PageLayout } from "./PageLayout";
import { ThemeToggle } from "./ThemeToggle";
import { QualitySelect } from "./settings/QualitySelect";
import { AggregatedSourceSelect } from "./settings/AggregatedSourceSelect";
import { SyncConfig } from "./settings/SyncConfig";
import { NeteaseLogin } from "./settings/NeteaseLogin";
import {
  useMusicStore,
  type FullScreenBackgroundMode,
} from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Slider } from "./ui/slider";
import {
  Image,
  Palette,
  Volume2,
  Tag,
  Database,
  Shield,
  Bell,
} from "lucide-react";
import { Switch } from "./ui/switch";
import { useAppStore } from "@/store/app-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { DownloadSetting } from "./settings/DownloadSetting";
import { SettingItem } from "./settings/SettingItem";
import { UpdateCheck } from "./settings/UpdateCheck";
import { IssueLogs } from "./settings/IssueLogs";
import { StreamCacheSetting } from "./settings/StreamCacheSetting";
import { SleepTimerSetting } from "./settings/SleepTimerSetting";
import { PlaybackSpeedSetting } from "./settings/PlaybackSpeedSetting";
import { AutoMatchSetting } from "./settings/AutoMatchSetting";
import { DataBackup } from "./settings/DataBackup";
import { useState } from "react";

interface SettingsPageProps {
  onBack?: () => void;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [dataBackupOpen, setDataBackupOpen] = useState(false);
  const { enableUpdateNotify, setEnableUpdateNotify } = useAppStore();
  const {
    volume,
    setVolume,
    enableProxyFallback,
    setEnableProxyFallback,
    showSourceBadge,
    setShowSourceBadge,
    fullScreenBackgroundMode,
    setFullScreenBackgroundMode,
  } = useMusicStore(
    useShallow((state) => ({
      volume: state.volume,
      setVolume: state.setVolume,
      enableProxyFallback: state.enableProxyFallback,
      setEnableProxyFallback: state.setEnableProxyFallback,
      showSourceBadge: state.showSourceBadge,
      setShowSourceBadge: state.setShowSourceBadge,
      fullScreenBackgroundMode: state.fullScreenBackgroundMode,
      setFullScreenBackgroundMode: state.setFullScreenBackgroundMode,
    }))
  );

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 pb-bottom-stack overflow-y-auto">
        <SettingsSection title="常用设置">
          <AggregatedSourceSelect />
          <SettingItem
            icon={Volume2}
            title="音量调节"
            action={
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-10 text-right">
                  {Math.round(volume * 100)}%
                </span>
                <Slider
                  value={[volume * 100]}
                  onValueChange={([value]) => setVolume(value / 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-32"
                />
              </div>
            }
          />
          <QualitySelect />
          <SleepTimerSetting />
          <PlaybackSpeedSetting />
          <DownloadSetting />
        </SettingsSection>

        <SettingsSection title="界面设置">
          <SettingItem
            icon={Palette}
            title="主题切换"
            action={<ThemeToggle />}
          />
          <SettingItem
            icon={Tag}
            title="显示音源标签"
            subtitle="在歌曲列表中始终显示音源平台标签"
            action={
              <Switch
                checked={showSourceBadge}
                onCheckedChange={setShowSourceBadge}
              />
            }
          />
          <SettingItem
            icon={Image}
            title="全屏背景"
            action={
              <Select
                value={fullScreenBackgroundMode}
                onValueChange={(value) =>
                  setFullScreenBackgroundMode(value as FullScreenBackgroundMode)
                }
              >
                <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20 w-36">
                  <SelectValue placeholder="背景" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="theme">动态主题色</SelectItem>
                  <SelectItem value="cover">模糊封面</SelectItem>
                  <SelectItem value="texture">深色质感</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </SettingsSection>

        <SettingsSection title="账号数据">
          <NeteaseLogin />
          <SyncConfig />
          <SettingItem
            icon={Database}
            title="数据备份"
            subtitle="导出或导入全部收藏、歌单与设置"
            onClick={() => setDataBackupOpen(true)}
            showChevron
          />
        </SettingsSection>

        <SettingsSection title="高级设置">
          <AutoMatchSetting />
          <StreamCacheSetting />
          <SettingItem
            icon={Shield}
            title="代理回退"
            subtitle="音源解析失败时自动尝试备用源"
            action={
              <Switch
                checked={enableProxyFallback}
                onCheckedChange={setEnableProxyFallback}
              />
            }
          />
          <SettingItem
            icon={Bell}
            title="更新通知"
            subtitle="有新版本时自动提示"
            action={
              <Switch
                checked={enableUpdateNotify}
                onCheckedChange={setEnableUpdateNotify}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="关于系统">
          <UpdateCheck />
          <IssueLogs />
        </SettingsSection>
      </div>

      <DataBackup open={dataBackupOpen} onOpenChange={setDataBackupOpen} />
    </PageLayout>
  );
}

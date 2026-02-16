/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

interface Window {
  __cleanedin_loader?: boolean;
  __cleanedin_loader_state?: string;
  __cleanedin_loader_error?: string;
  __cleanedin_content_boot?: boolean;
  __cleanedin_observed_posts?: number;
  __cleanedin_root_mode?: 'feed-root' | 'body-fallback';
}

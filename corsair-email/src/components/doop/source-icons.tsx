import type { CSSProperties } from "react";

const stroke = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2px" } satisfies CSSProperties;

export function DoopBotIcon({ size }: { size: number }) {
  return <span aria-hidden="true" style={{ display: "block", width: size, height: size, flexShrink: 0 }}><svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%"><path d="M12 8V4H8" style={stroke} /><rect width="16" height="12" x="4" y="8" rx="2" style={stroke} /><path d="M2 14h2" style={stroke} /><path d="M20 14h2" style={stroke} /><path d="M15 13v2" style={stroke} /><path d="M9 13v2" style={stroke} /></svg></span>;
}
export function DoopNewChatIcon() {
  return <svg aria-hidden="true" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" style={stroke} /><path d="M12 7v6" style={stroke} /><path d="M9 10h6" style={stroke} /></svg>;
}
export function DoopHistoryIcon() {
  return <svg aria-hidden="true" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" style={stroke} /><path d="M3 3v5h5" style={stroke} /><path d="M12 7v5l4 2" style={stroke} /></svg>;
}

type IconProps = { as?: "span" | "div"; size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" };
function Icon({ as: Tag = "span", size = 16, className, children }: IconProps & { children: import("react").ReactNode }) {
  return <Tag data-doop-icon aria-hidden="true" className={className} style={{ display:"block", width:size, height:size, flex:"0 0 auto" }}><svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">{children}</svg></Tag>;
}
export function DoopCalendarIcon(props: IconProps) { return <Icon {...props}><path d="M8 2v4" style={stroke} /><path d="M16 2v4" style={stroke} /><rect width="18" height="18" x="3" y="4" rx="2" style={stroke} /><path d="M3 10h18" style={stroke} /></Icon>; }
export function DoopClockIcon(props: IconProps) { return <Icon {...props}><circle cx="12" cy="12" r="10" style={stroke} /><polyline points="12 6 12 12 16 14" style={stroke} /></Icon>; }
export function DoopUsersIcon(props: IconProps) { return <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" style={stroke} /><circle cx="9" cy="7" r="4" style={stroke} /><path d="M22 21v-2a4 4 0 0 0-3-3.87" style={stroke} /><path d="M16 3.13a4 4 0 0 1 0 7.75" style={stroke} /></Icon>; }
export function DoopMapPinIcon(props: IconProps) { return <Icon {...props}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" style={stroke} /><circle cx="12" cy="10" r="3" style={stroke} /></Icon>; }
export function DoopWarningIcon(props: IconProps) { return <Icon {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" style={stroke} /><path d="M12 9v4" style={stroke} /><path d="M12 17h.01" style={stroke} /></Icon>; }
export function DoopMailIcon(props: IconProps) { return <Icon {...props}><rect width="20" height="16" x="2" y="4" rx="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2px" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2px" /></Icon>; }

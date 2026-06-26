import React from "react";

interface Props extends React.SVGProps<SVGSVGElement> {
  size?: number;
  showText?: boolean;
  textColorClass?: string;
}

export function TupucaLogo({
  size = 32,
  showText = false,
  textColorClass = "text-white",
  className = "",
  ...props
}: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 animate-fade-in"
        {...props}
      >
        {/* Yellow Squircle App Icon Background */}
        <rect
          width="100"
          height="100"
          rx="24"
          fill="#FFCC00"
        />

        {/* Dark Charcoal Inner Circle */}
        <circle cx="50" cy="50" r="41" fill="#222129" />

        {/* Circuit-style letter 'T' */}
        <path
          d="M 39 43 L 27 43 L 27 31 L 46 31 L 46 75 L 54 75 L 54 43 L 73 43 L 73 31 L 54 31"
          stroke="white"
          strokeWidth="5.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />

        {/* Circuit Connection Nodes (dots) */}
        <circle cx="39" cy="43" r="4.5" fill="white" />
        <circle cx="54" cy="31" r="4.5" fill="white" />

        {/* Yellow/Gold Plus Sign on the bottom-right */}
        <path
          d="M 61 68 H 73 M 67 62 V 74"
          stroke="#FFCC00"
          strokeWidth="5.5"
          strokeLinecap="square"
          fill="none"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-sans font-extrabold tracking-tight leading-none uppercase ${textColorClass}`} style={{ fontSize: size * 0.52 }}>
            tupuca+
          </span>
          <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono leading-none mt-1">
            sala ops
          </span>
        </div>
      )}
    </div>
  );
}

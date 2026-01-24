import { useCanvasStore } from "@/store";

const GUIDE_COLOR = "#FF00FF";

export function SmartGuides() {
  const smartGuides = useCanvasStore((s) => s.smartGuides);
  const transform = useCanvasStore((s) => s.transform);

  if (smartGuides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <svg className="h-full w-full">
        <defs>
          <pattern id="dash-pattern" patternUnits="userSpaceOnUse" width={8 / transform.scale} height={1}>
            <line x1="0" y1="0" x2={4 / transform.scale} y2="0" stroke={GUIDE_COLOR} strokeWidth={1 / transform.scale} />
          </pattern>
        </defs>
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {smartGuides.map((guide, i) => {
            const strokeWidth = 1 / transform.scale;

            if (guide.type === "alignment") {
              const x1 = guide.x1 ?? 0;
              const y1 = guide.y1 ?? 0;
              const x2 = guide.x2 ?? 0;
              const y2 = guide.y2 ?? 0;

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={GUIDE_COLOR}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${3 / transform.scale} ${3 / transform.scale}`}
                />
              );
            }

            if (guide.type === "spacing") {
              const x1 = guide.x1 ?? 0;
              const y1 = guide.y1 ?? 0;
              const x2 = guide.x2 ?? 0;
              const y2 = guide.y2 ?? 0;
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2;

              const isHorizontal = Math.abs(y2 - y1) < 0.1;
              const lineLength = isHorizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);

              if (lineLength < 5) return null;

              const capSize = 6 / transform.scale;

              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GUIDE_COLOR} strokeWidth={strokeWidth} />

                  {isHorizontal ? (
                    <>
                      <line x1={x1} y1={y1 - capSize} x2={x1} y2={y1 + capSize} stroke={GUIDE_COLOR} strokeWidth={strokeWidth} />
                      <line x1={x2} y1={y2 - capSize} x2={x2} y2={y2 + capSize} stroke={GUIDE_COLOR} strokeWidth={strokeWidth} />
                    </>
                  ) : (
                    <>
                      <line x1={x1 - capSize} y1={y1} x2={x1 + capSize} y2={y1} stroke={GUIDE_COLOR} strokeWidth={strokeWidth} />
                      <line x1={x2 - capSize} y1={y2} x2={x2 + capSize} y2={y2} stroke={GUIDE_COLOR} strokeWidth={strokeWidth} />
                    </>
                  )}

                  {guide.label && (
                    <foreignObject
                      x={cx - 20 / transform.scale}
                      y={cy - 10 / transform.scale}
                      width={40 / transform.scale}
                      height={20 / transform.scale}
                      className="overflow-visible"
                    >
                      <div
                        style={{
                          background: GUIDE_COLOR,
                          color: "white",
                          fontSize: `${11 / transform.scale}px`,
                          fontWeight: 500,
                          fontFamily: "Inter, system-ui, sans-serif",
                          padding: `${2 / transform.scale}px ${6 / transform.scale}px`,
                          borderRadius: `${3 / transform.scale}px`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "max-content",
                          transform: "translate(-50%, -50%)",
                          marginLeft: "50%",
                          marginTop: "50%",
                          lineHeight: 1,
                        }}
                      >
                        {guide.label}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            }

            if (guide.type === "center") {
              const cx = guide.cx ?? 0;
              const cy = guide.cy ?? 0;
              const size = 4 / transform.scale;

              return (
                <g key={i}>
                  <polygon
                    points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
                    fill={GUIDE_COLOR}
                    stroke="white"
                    strokeWidth={strokeWidth * 0.5}
                  />
                </g>
              );
            }

            return null;
          })}
        </g>
      </svg>
    </div>
  );
}

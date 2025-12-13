import { useCanvasStore } from "@/store";


export function SmartGuides() {
  const smartGuides = useCanvasStore((s) => s.smartGuides);
  const transform = useCanvasStore((s) => s.transform);

  // We render an SVG that covers the viewport, but we apply the transform group to match canvas world space
  // OR we can just map the lines. Applying transform to a group is easier.

  if (smartGuides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
       <svg className="h-full w-full">
           <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
               {smartGuides.map((guide, i) => {
                   const strokeColor = "#F24822"; // Figma Red
                   const strokeWidth = 1 / transform.scale;
                   const markerSize = 4 / transform.scale;

                   if (guide.type === 'x' || guide.type === 'y') {
                       return (
                           <g key={i}>
                               <line
                                   x1={guide.x1 ?? guide.x}
                                   y1={guide.y1 ?? guide.y}
                                   x2={guide.x2 ?? guide.x}
                                   y2={guide.y2 ?? guide.y}
                                   stroke={strokeColor}
                                   strokeWidth={strokeWidth}
                               />
                               {/* X markers at endpoints */}
                               {[
                                   { x: guide.x1 ?? guide.x, y: guide.y1 ?? guide.y },
                                   { x: guide.x2 ?? guide.x, y: guide.y2 ?? guide.y }
                               ].map((p, idx) => (
                                   <g key={idx} transform={`translate(${p.x}, ${p.y})`}>
                                       <line x1={-markerSize} y1={-markerSize} x2={markerSize} y2={markerSize} stroke={strokeColor} strokeWidth={strokeWidth} />
                                       <line x1={-markerSize} y1={markerSize} x2={markerSize} y2={-markerSize} stroke={strokeColor} strokeWidth={strokeWidth} />
                                   </g>
                               ))}
                           </g>
                       );
                   }
                   if (guide.type === 'distance') {
                       // Render gap line and label
                       // distance guides usually are a single line segment with a label in the middle
                       // For X gap: line from x1 to x2 at y
                       // For Y gap: line from y1 to y2 at x


                       // Actually, let's look at how we pushed them.
                       // X-Gap: x was neighbor.maxY, x2 was pMinX. y was center.
                       // Oops, previous logic pushed x/x2?

                       // Let's standardise the guide object for distance:
                       // x1, y1 -> Start point
                       // x2, y2 -> End point
                       // label -> Text

                       // In X-Gap logic (snapping.ts):
                       // guides.push({ type: "distance", x: leftNeighbor.maxX, y: center, label: ..., x2: pMinX }) -> wait, this is messy.
                       // x1=leftNeighbor.maxX, y1=center, x2=pMinX, y2=center.

                       const gx1 = guide.x1 ?? guide.x ?? 0;
                       const gy1 = guide.y1 ?? guide.y ?? 0;
                       const gx2 = guide.x2 ?? guide.x ?? 0;
                       const gy2 = guide.y2 ?? guide.y ?? 0;

                       const cx = (gx1 + gx2) / 2;
                       const cy = (gy1 + gy2) / 2;

                       return (
                           <g key={i}>
                               {/* Gap Line */}
                               <line
                                   x1={gx1} y1={gy1} x2={gx2} y2={gy2}
                                   stroke={strokeColor}
                                   strokeWidth={strokeWidth}
                               />
                               {/* Perpendicular caps? Figma doesn't always show them for gaps, but shows label. Screenshot shows label in box. */}

                               {/* Label Box */}
                               <foreignObject x={cx - 16 / transform.scale} y={cy - 8 / transform.scale} width={32 / transform.scale} height={16 / transform.scale} className="overflow-visible">
                                   <div
                                       style={{
                                            background: strokeColor,
                                            color: 'white',
                                            fontSize: `${10 / transform.scale}px`,
                                            padding: `${2/transform.scale}px ${4/transform.scale}px`,
                                            borderRadius: `${2/transform.scale}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 'max-content',
                                            transform: 'translate(-50%, -50%)',
                                            lineHeight: 1
                                       }}
                                   >
                                       {guide.label}
                                   </div>
                               </foreignObject>
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

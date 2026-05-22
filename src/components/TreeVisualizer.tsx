import React, { useMemo, useState, useEffect, useRef } from 'react';
import { hierarchy, tree } from 'd3-hierarchy';
import type { TreeNode } from '../utils/nlpParser';

interface TreeVisualizerProps {
  data: TreeNode;
  onNodeClick: (nodeId: string, currentName: string) => void;
}

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, onNodeClick }) => {
  const root = useMemo(() => {
    const rootNode = hierarchy(data);
    const treeLayout = tree<TreeNode>().nodeSize([100, 100]); // [dx, dy]
    return treeLayout(rootNode);
  }, [data]);

  // Reset offsets when data changes (e.g. text input updates)
  const [draggedOffsets, setDraggedOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  
  useEffect(() => {
    setDraggedOffsets({});
  }, [data]);

  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ mouseX: number; mouseY: number; initDx: number; initDy: number } | null>(null);
  
  // Track if dragging occurred to prevent triggering edit modal on drag release
  const isDraggingRef = useRef(false);

  // Find min/max bounds to center the tree and calculate responsive SVG viewport
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  root.descendants().forEach(node => {
    const nodeId = node.data.id || '';
    const offset = draggedOffsets[nodeId] || { dx: 0, dy: 0 };
    const x = node.x + offset.dx;
    const y = node.y + offset.dy;
    
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const width = maxX - minX + 200;
  const height = maxY - minY + 200;
  const viewBox = `${minX - 100} -50 ${width} ${height}`;

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const currentOffset = draggedOffsets[nodeId] || { dx: 0, dy: 0 };
    setDragStartCoords({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initDx: currentOffset.dx,
      initDy: currentOffset.dy
    });
    setActiveDragNodeId(nodeId);
    isDraggingRef.current = false;
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (activeDragNodeId === null || dragStartCoords === null) return;
    
    const svgElement = e.currentTarget as SVGSVGElement;
    const rect = svgElement.getBoundingClientRect();
    
    // Scale mouse movement by SVG viewport ratio so it tracks the cursor perfectly
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    const deltaX = (e.clientX - dragStartCoords.mouseX) * scaleX;
    const deltaY = (e.clientY - dragStartCoords.mouseY) * scaleY;
    
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      isDraggingRef.current = true;
    }

    setDraggedOffsets(prev => ({
      ...prev,
      [activeDragNodeId]: {
        dx: dragStartCoords.initDx + deltaX,
        dy: dragStartCoords.initDy + deltaY
      }
    }));
  };

  const handleSvgMouseUpOrLeave = () => {
    setActiveDragNodeId(null);
    setDragStartCoords(null);
  };

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={viewBox} 
      className="tree-container"
      onMouseMove={handleSvgMouseMove}
      onMouseUp={handleSvgMouseUpOrLeave}
      onMouseLeave={handleSvgMouseUpOrLeave}
    >
      <g>
        {/* Draw Links (Branches) using adjusted dragged positions */}
        {root.links().map((link, i) => {
          const sourceId = link.source.data.id || '';
          const targetId = link.target.data.id || '';
          
          const sourceOffset = draggedOffsets[sourceId] || { dx: 0, dy: 0 };
          const targetOffset = draggedOffsets[targetId] || { dx: 0, dy: 0 };
          
          const sx = link.source.x + sourceOffset.dx;
          const sy = link.source.y + sourceOffset.dy;
          const tx = link.target.x + targetOffset.dx;
          const ty = link.target.y + targetOffset.dy;
          
          return (
            <path
              key={`link-${i}`}
              className="link"
              d={`M${sx},${sy} L${tx},${ty}`}
            />
          );
        })}

        {/* Draw Nodes */}
        {root.descendants().map((node, i) => {
          const isLeaf = !node.children;
          const nodeId = node.data.id || '';
          const offset = draggedOffsets[nodeId] || { dx: 0, dy: 0 };
          const x = node.x + offset.dx;
          const y = node.y + offset.dy;
          
          return (
            <g 
              key={`node-${nodeId || i}`} 
              className={`node ${isLeaf ? 'node-leaf' : 'node-group'}`}
              transform={`translate(${x},${y})`}
              onMouseDown={(e) => handleNodeMouseDown(e, nodeId)}
              onClick={(e) => {
                e.stopPropagation();
                // Only open tag editor if we were clicking, not ending a drag
                if (!isDraggingRef.current) {
                  onNodeClick(node.data.id, node.data.name);
                }
              }}
            >
              {!isLeaf ? (
                (() => {
                  const textLength = node.data.name.length;
                  const nodeWidth = Math.max(44, textLength * 9 + 18);
                  const nodeHeight = 44;
                  const rx = nodeHeight / 2;
                  
                  return (
                    <>
                      <rect 
                        x={-nodeWidth / 2} 
                        y={-nodeHeight / 2} 
                        width={nodeWidth} 
                        height={nodeHeight} 
                        rx={rx} 
                        ry={rx}
                      />
                      <text dy={5} textAnchor="middle">{node.data.name}</text>
                    </>
                  );
                })()
              ) : (
                <>
                  {/* Subtle invisible hit area for dragging leaf nodes */}
                  <rect 
                    x={-40} 
                    y={5} 
                    width={80} 
                    height={30} 
                    fill="transparent" 
                    style={{ cursor: 'grab' }}
                  />
                  <text y={25} textAnchor="middle">{node.data.name}</text>
                </>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

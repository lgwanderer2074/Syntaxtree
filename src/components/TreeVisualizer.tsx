import React, { useMemo } from 'react';
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

  // Find min/max bounds to center the tree
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  root.descendants().forEach(node => {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  });

  const width = maxX - minX + 200;
  const height = maxY - minY + 200;
  const viewBox = `${minX - 100} -50 ${width} ${height}`;

  return (
    <svg width="100%" height="100%" viewBox={viewBox} className="tree-container">
      <g>
        {/* Draw Links */}
        {root.links().map((link, i) => (
          <path
            key={`link-${i}`}
            className="link"
            d={`M${link.source.x},${link.source.y} L${link.target.x},${link.target.y}`}
          />
        ))}

        {/* Draw Nodes */}
        {root.descendants().map((node, i) => {
          const isLeaf = !node.children;
          return (
            <g 
              key={`node-${node.data.id || i}`} 
              className={`node ${isLeaf ? 'node-leaf' : 'node-group'}`}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => {
                // Only allow editing non-leaf nodes for now (the tags)
                if (!isLeaf) {
                  onNodeClick(node.data.id, node.data.name);
                }
              }}
            >
              {!isLeaf ? (
                <>
                  <circle r={22} />
                  <text dy={5} textAnchor="middle">{node.data.name}</text>
                </>
              ) : (
                <text y={25} textAnchor="middle">{node.data.name}</text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

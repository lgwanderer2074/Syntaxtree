import { useState } from 'react';
import { TreeVisualizer } from './components/TreeVisualizer';
import { generateTreeFromSentence, generateId, type TreeNode } from './utils/nlpParser';
import { Download, Share2, Type, Plus, Trash2 } from 'lucide-react';

interface TreeItem {
  id: string;
  title: string;
  text: string;
  treeData: TreeNode;
}

function App() {
  const [items, setItems] = useState<TreeItem[]>([
    { 
      id: generateId(), 
      title: 'Sentence 1',
      text: 'The quick brown fox jumps', 
      treeData: generateTreeFromSentence('The quick brown fox jumps') 
    }
  ]);
  const [editingNode, setEditingNode] = useState<{ itemId: string, nodeId: string, name: string } | null>(null);

  const handleTextChange = (id: string, newText: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, text: newText, treeData: generateTreeFromSentence(newText) };
      }
      return item;
    }));
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setItems(items.map(item => item.id === id ? { ...item, title: newTitle } : item));
  };

  const addItem = () => {
    setItems([...items, { 
      id: generateId(), 
      title: `Sentence ${items.length + 1}`,
      text: '', 
      treeData: generateTreeFromSentence('') 
    }]);
  };
  
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleNodeEdit = (itemId: string, nodeId: string, currentName: string) => {
    setEditingNode({ itemId, nodeId, name: currentName });
  };

  const saveNodeEdit = () => {
    if (!editingNode) return;

    const updateNode = (node: TreeNode): TreeNode => {
      if (node.id === editingNode.nodeId) {
        return { ...node, name: editingNode.name };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    };

    setItems(items.map(item => {
      if (item.id === editingNode.itemId) {
        return { ...item, treeData: updateNode(item.treeData) };
      }
      return item;
    }));
    setEditingNode(null);
  };

  return (
    <>
      <header className="app-header">
        <div className="app-title">
          <Share2 size={24} />
          SyntaxTree Premium
        </div>
        <button className="primary-btn">
          <Download size={18} /> Export
        </button>
      </header>
      
      <main className="main-content">
        <aside className="sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {items.map((item) => (
              <div key={item.id} className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <Type size={16} style={{ color: 'var(--text-muted)' }} />
                    <input 
                      value={item.title}
                      onChange={(e) => handleTitleChange(item.id, e.target.value)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-main)', 
                        fontSize: '0.875rem', 
                        fontWeight: 500, 
                        outline: 'none',
                        width: '100%',
                        borderBottom: '1px solid transparent',
                        padding: '2px 0'
                      }}
                      onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent)'}
                      onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                    />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <textarea 
                  value={item.text}
                  onChange={(e) => handleTextChange(item.id, e.target.value)}
                  placeholder="Type a sentence here..."
                  style={{ minHeight: '80px' }}
                />
              </div>
            ))}

            <button className="secondary-btn" onClick={addItem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
              <Plus size={18} /> Add another tree
            </button>
            
            <span className="hint" style={{ textAlign: 'center' }}>
              Click any node circle in the tree to edit its tag.
            </span>
          </div>
        </aside>

        <section className="workspace" style={{ flexDirection: 'column', overflowY: 'auto', justifyContent: 'flex-start' }}>
          {items.map((item) => (
            <div key={item.id} style={{ width: '100%', minHeight: '400px', flexShrink: 0, borderBottom: items.length > 1 ? '1px solid var(--panel-border)' : 'none', position: 'relative' }}>
              <TreeVisualizer data={item.treeData} onNodeClick={(nodeId, name) => handleNodeEdit(item.id, nodeId, name)} />
            </div>
          ))}
        </section>
      </main>

      {editingNode && (
        <div className="edit-modal-backdrop" onClick={() => setEditingNode(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Tag</h3>
            <input 
              autoFocus
              value={editingNode.name}
              onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveNodeEdit()}
            />
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setEditingNode(null)}>Cancel</button>
              <button className="primary-btn" onClick={saveNodeEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

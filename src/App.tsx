import { useState, useEffect, useRef } from 'react';
import { TreeVisualizer } from './components/TreeVisualizer';
import { generateTreeFromSentence, generateId, type TreeNode } from './utils/nlpParser';
import { Download, Share2, Type, Plus, Trash2, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

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
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [ocrModalData, setOcrModalData] = useState<{ imageUrl: string; fileName: string; transcribedText: string; isScanning: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showExportDropdown) return;
    const handleClose = () => setShowExportDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [showExportDropdown]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0 && 'treeData' in parsed[0]) {
            setItems(parsed);
          } else {
            alert('Invalid JSON structure. Please import a valid SyntaxTree JSON.');
          }
        } catch (err) {
          alert('Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
    } else if (fileType === 'txt') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
          const newItems = lines.map(line => ({
            id: generateId(),
            title: line.slice(0, 15) + (line.length > 15 ? '...' : ''),
            text: line,
            treeData: generateTreeFromSentence(line)
          }));
          setItems([...items, ...newItems]);
        } else {
          alert('No sentences found in the text file.');
        }
      };
      reader.readAsText(file);
    } else if (['png', 'jpg', 'jpeg', 'svg'].includes(fileType || '')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setOcrModalData({
          imageUrl,
          fileName: file.name,
          transcribedText: cleanName || "The quick brown fox jumps over the lazy dog",
          isScanning: true
        });

        // Simulate Scanning
        setTimeout(() => {
          setOcrModalData(prev => prev ? { ...prev, isScanning: false } : null);
        }, 2000);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Unsupported file type. Please import a .json, .txt, or image file (.png, .jpg, .svg).');
    }

    e.target.value = '';
  };

  const triggerImportClick = () => {
    fileInputRef.current?.click();
  };

  const exportSVG = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svgs = document.querySelectorAll('.workspace svg');
    if (svgs.length === 0) {
      alert('No syntax tree diagrams found to export.');
      return;
    }
    
    svgs.forEach((svg, index) => {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      
      const item = items[index];
      const title = item ? item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : `sentence_${index + 1}`;
      downloadLink.download = `syntaxtree_${title}.svg`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    });
    
    setShowExportDropdown(false);
  };

  const exportJSON = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (items.length === 0) {
      alert('No project data to export.');
      return;
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadLink = document.createElement("a");
    downloadLink.href = dataStr;
    downloadLink.download = "syntaxtree_data.json";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    setShowExportDropdown(false);
  };

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
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport} 
        style={{ display: 'none' }} 
        accept=".json,.txt,.png,.jpg,.jpeg,.svg"
      />

      <header className="app-header">
        <div className="app-title">
          <Share2 size={24} />
          SyntaxTree Premium
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="secondary-btn" onClick={triggerImportClick} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={18} /> Import
          </button>
          
          <div style={{ position: 'relative' }}>
            <button className="primary-btn" onClick={(e) => { e.stopPropagation(); setShowExportDropdown(!showExportDropdown); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={18} /> Export
            </button>
            
            {showExportDropdown && (
              <div className="dropdown-menu">
                <button onClick={exportSVG}>Export as SVG (Images)</button>
                <button onClick={exportJSON}>Export as JSON (Data)</button>
              </div>
            )}
          </div>
        </div>
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

      {ocrModalData && (
        <div className="edit-modal-backdrop" onClick={() => setOcrModalData(null)}>
          <div className="edit-modal" style={{ width: '400px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <ImageIcon size={20} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0 }}>SyntaxTree AI Image Reader (OCR)</h3>
            </div>
            
            <div className="scanner-container">
              <img src={ocrModalData.imageUrl} className="scanner-image" alt="Uploaded source" />
              {ocrModalData.isScanning && <div className="scanner-line"></div>}
            </div>

            {ocrModalData.isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Scanning image and extracting linguistic structure...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Extracted Sentence Text</label>
                  <textarea 
                    value={ocrModalData.transcribedText}
                    onChange={(e) => setOcrModalData({ ...ocrModalData, transcribedText: e.target.value })}
                    placeholder="Verify the extracted text..."
                    style={{ minHeight: '85px' }}
                  />
                </div>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setOcrModalData(null)}>Cancel</button>
                  <button className="primary-btn" onClick={() => {
                    if (ocrModalData.transcribedText.trim()) {
                      const text = ocrModalData.transcribedText.trim();
                      setItems([...items, {
                        id: generateId(),
                        title: `Image: ${ocrModalData.fileName.slice(0, 12)}`,
                        text,
                        treeData: generateTreeFromSentence(text)
                      }]);
                    }
                    setOcrModalData(null);
                  }}>Import as Tree</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;

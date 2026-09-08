import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Zap, Unlink, Expand, Minimize2 } from 'lucide-react';
import { Idea, IdeaLink, IdeaType } from '../types';
import { ideasApi } from '../services/api';
import IdeaGraph from '../components/ideamap/IdeaGraph';
import IdeaToolbar from '../components/ideamap/IdeaToolbar';
import IdeaSidebar from '../components/ideamap/IdeaSidebar';
import OrientationGlobe from '../components/ideamap/OrientationGlobe';
import { ConfirmModal, useNexusConfirm, NexusSpinner, showToast } from '../components/ui/NexusModal';

const CAMERA_STORAGE_KEY = 'nexus-ideamap-camera';

function saveCameraState(state: any) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

export default function IdeaMap() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [links, setLinks] = useState<IdeaLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; title: string }[]>([]);
  const [drillParent, setDrillParent] = useState<string | null>(null);
  const graphRef = useRef<any>(null);
  const getCameraPosRef = useRef<() => { x: number; y: number; z: number }>(() => ({ x: 0, y: 0, z: 200 }));
  const getCameraRotationRef = useRef<() => { x: number; y: number; z: number }>(() => ({ x: 0, y: 0, z: 0 }));
  const getCameraDistanceRef = useRef<() => number>(() => 250);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((e) => console.error('Fullscreen error:', e));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Force graph resize after fullscreen change
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Save camera state on unmount
  useEffect(() => {
    return () => {
      try {
        const pos = getCameraPosRef.current();
        saveCameraState({ ...pos, lookAtX: 0, lookAtY: 0, lookAtZ: 0 });
      } catch (e) { /* ignore */ }
    };
  }, []);

  const fetchData = async () => {
    try {
      const response = await ideasApi.getAll();
      if (response.success && response.data) {
        setIdeas(response.data.ideas);
        setLinks(response.data.links);
      }
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter ideas by drill-down parent
  const visibleIdeas = drillParent
    ? ideas.filter(i => i.id === drillParent || i.parentId === drillParent)
    : ideas;

  // Filter by search
  const searchFiltered = searchQuery
    ? visibleIdeas.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleIdeas;

  // Compute connected nodes for selected idea
  const connectedIdeas = selectedId
    ? links
        .filter(l => l.sourceId === selectedId || l.targetId === selectedId)
        .map(l => {
          const otherId = l.sourceId === selectedId ? l.targetId : l.sourceId;
          return ideas.find(i => i.id === otherId);
        })
        .filter(Boolean) as Idea[]
    : [];

  // Store pending position for new nodes
  const pendingPosRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const handleAdd = useCallback(async (parentId?: string) => {
    setIsSaving(true);
    try {
      const response = await ideasApi.create({
        title: 'Новая идея',
        type: 'default',
        parentId: parentId || drillParent || undefined,
      });
      if (response.success && response.data) {
        // Save position for the new node
        if (pendingPosRef.current) {
          const positions = JSON.parse(localStorage.getItem('nexus-ideamap-nodes') || '{}');
          positions[response.data.id] = pendingPosRef.current;
          localStorage.setItem('nexus-ideamap-nodes', JSON.stringify(positions));
          pendingPosRef.current = null;
        }
        await fetchData();
        setSelectedId(response.data.id);
      }
    } catch (error) {
      console.error('Failed to create idea:', error);
    } finally {
      setIsSaving(false);
    }
  }, [drillParent]);

  const handleUpdate = useCallback(async (id: string, data: Partial<Idea>) => {
    try {
      await ideasApi.update(id, data);
      await fetchData();
    } catch (error) {
      console.error('Failed to update idea:', error);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    const idea = ideas.find(i => i.id === id);
    showConfirm(
      'УДАЛИТЬ ИДЕЮ?',
      `"${idea?.title}" и все связи будут удалены.`,
      async () => {
        setIsSaving(true);
        try {
          await ideasApi.delete(id);
          setSelectedId(null);
          await fetchData();
          showToast('Идея удалена', 'success');
        } catch (error) {
          console.error('Failed to delete idea:', error);
          showToast('Ошибка удаления', 'error');
        } finally {
          setIsSaving(false);
        }
      },
      'danger'
    );
  }, [ideas, showConfirm]);

  const handleLinkTarget = useCallback(async (targetId: string) => {
    if (!linkSource) return;
    setIsSaving(true);
    try {
      await ideasApi.createLink({ sourceId: linkSource, targetId });
      await fetchData();
      setLinkMode(false);
      showToast('Связь установлена', 'success');
    } catch (error) {
      console.error('Failed to create link:', error);
      showToast('Ошибка создания связи', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [linkSource]);

  const handleUnlink = useCallback(async (linkId: string) => {
    showConfirm(
      'РАСЦЕПИТЬ?',
      'Связь между идеями будет удалена.',
      async () => {
        setIsSaving(true);
        try {
          await ideasApi.deleteLink(linkId);
          setSelectedLinkId(null);
          await fetchData();
          showToast('Связь удалена', 'success');
        } catch (error) {
          console.error('Failed to delete link:', error);
          showToast('Ошибка удаления связи', 'error');
        } finally {
          setIsSaving(false);
        }
      },
      'danger'
    );
  }, [showConfirm]);

  const handleDrillDown = useCallback((id: string) => {
    const idea = ideas.find(i => i.id === id);
    if (idea) {
      setDrillParent(id);
      setBreadcrumb(prev => [...prev, { id: idea.id, title: idea.title }]);
      setSelectedId(null);
    }
  }, [ideas]);

  const handleBreadcrumbClick = useCallback((id: string | null) => {
    if (id === null) {
      setDrillParent(null);
      setBreadcrumb([]);
    } else {
      const idx = breadcrumb.findIndex(b => b.id === id);
      setBreadcrumb(breadcrumb.slice(0, idx + 1));
      setDrillParent(id);
    }
    setSelectedId(null);
  }, [breadcrumb]);

  const handleToggleFilter = useCallback((type: IdeaType) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const selectedIdea = ideas.find(i => i.id === selectedId) || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          </motion.div>
          <p className="neon-text text-xl font-mono" style={{ color: 'var(--color-primary)' }}>
            ЗАГРУЗКА КАРТЫ ИДЕЙ...
          </p>
        </div>
      </div>
    );
  }

  // Mobile warning
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)' }}>
            <Lightbulb className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 className="text-lg font-bold font-mono neon-text mb-2" style={{ color: 'var(--color-primary)' }}>
            КАРТА ИДЕЙ
          </h2>
          <p className="text-sm font-mono text-gray-400 mb-4">
            // 3D КАРТА ДОСТУПНА ТОЛЬКО НА ПК
          </p>
          <p className="text-xs text-gray-500 mb-6">
            Для работы с картой идей используйте десктопную версию. На мобильных устройствах 3D-графика работает нестабильно.
          </p>
          <a href="/"
            className="inline-block px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            НА ГЛАВНУЮ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3" style={{ backgroundImage: 'none' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Lightbulb className="w-7 h-7 md:w-8 md:h-8" />
            КАРТА ИДЕЙ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            // {ideas.length} ИДЕЙ • {links.length} СВЯЗЕЙ
            {breadcrumb.length > 0 && (
              <span className="ml-2">
                {breadcrumb.map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && ' > '}
                    <button
                      onClick={() => handleBreadcrumbClick(i === 0 ? null : breadcrumb[i - 1].id)}
                      className="hover:text-gray-200 transition-colors"
                    >
                      {b.title}
                    </button>
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>
        <IdeaToolbar
          onAdd={() => handleAdd()}
          linkMode={linkMode}
          onToggleLinkMode={() => { setLinkMode(!linkMode); setLinkSource(null); }}
          onZoomAll={() => graphRef.current?.zoomToFit(400, 50)}
          filterTypes={filterTypes}
          onToggleFilter={handleToggleFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          allIdeas={ideas}
          onSearchSelect={(id) => { setSelectedId(id); setSearchQuery(''); }}
        />
      </div>

      {/* 3D Graph */}
      <div ref={containerRef} className="flex-1 rounded-2xl overflow-hidden relative" style={{ border: '1px solid var(--color-border)' }}>
        <IdeaGraph
          ideas={searchFiltered}
          links={links}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDrillDown={handleDrillDown}
          onEdit={(id) => setSelectedId(id)}
          onDelete={handleDelete}
          linkMode={linkMode}
          linkSource={linkSource}
          onLinkSource={setLinkSource}
          onLinkTarget={handleLinkTarget}
          filterTypes={filterTypes}
          selectedLinkId={selectedLinkId}
          onSelectLink={setSelectedLinkId}
          onGetCameraPos={(cb) => { getCameraPosRef.current = cb; }}
          onGetCameraRotation={(cb) => { getCameraRotationRef.current = cb; }}
          onGetCameraDistance={(cb) => { getCameraDistanceRef.current = cb; }}
          onBackgroundClickAt={(pos) => { pendingPosRef.current = pos; handleAdd(); }}
        />

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 p-2 rounded-lg glass-frost text-gray-400 hover:text-gray-200 transition-colors z-10"
          title={isFullscreen ? 'Выйти из полноэкранного' : 'Полный экран'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>

        {/* Link mode indicator */}
        {linkMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl glass-frost font-mono text-xs z-10"
            style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
          >
            {linkSource ? '// КЛИКНИТЕ НА ВТОРУЮ ИДЕЮ ДЛЯ СВЯЗИ' : '// КЛИКНИТЕ НА ПЕРВУЮ ИДЕЮ'}
          </motion.div>
        )}

        {/* Selected link action */}
        {selectedLinkId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
          >
            <button
              onClick={() => handleUnlink(selectedLinkId)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all"
              style={{ backgroundColor: '#ff3b30', color: '#fff' }}
            >
              <Unlink className="w-4 h-4" />
              РАСЦЕПИТЬ
            </button>
            <button
              onClick={() => setSelectedLinkId(null)}
              className="px-3 py-2.5 rounded-xl glass font-mono text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              ОТМЕНА
            </button>
          </motion.div>
        )}

        {/* Empty state */}
        {ideas.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Lightbulb className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
              <p className="font-mono text-gray-500 mb-4">// ПОКА ПУСТО</p>
              <button
                onClick={() => handleAdd()}
                className="px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
              >
                СОЗДАТЬ ПЕРВУЮ ИДЕЮ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {selectedIdea && (
          <IdeaSidebar
            idea={selectedIdea}
            allIdeas={ideas}
            connectedIdeas={connectedIdeas}
            links={links}
            onClose={() => setSelectedId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddChild={handleAdd}
            onUnlink={handleUnlink}
            onNavigateToIdea={(id) => {
              setSelectedId(null);
              setTimeout(() => setSelectedId(id), 100);
            }}
            breadcrumb={breadcrumb}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
      />

      {/* Spinner */}
      <NexusSpinner isVisible={isSaving} text="СОХРАНЕНИЕ..." />

      {/* Orientation Globe + Zoom Scale */}
      <OrientationGlobe
        getCameraRotation={() => getCameraRotationRef.current()}
        getCameraDistance={() => getCameraDistanceRef.current()}
      />
    </div>
  );
}

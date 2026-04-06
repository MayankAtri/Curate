import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTopics } from '../hooks/useTopics';
import { preferencesService, authService } from '../services/api';

const getTopicImage = (id = '', name = '') => {
  const normalizedId = id.toLowerCase();
  const mapping = {
    'technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800',
    'ai': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
    'programming': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800',
    'gadgets': 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800',
    'cybersecurity': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
    'gaming': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800',
    'esports': 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&q=80&w=800',
    'science': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=800',
    'space': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800',
    'health': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800',
    'business': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800',
    'startups': 'https://images.unsplash.com/photo-1559136555-9303baea8bee?auto=format&fit=crop&q=80&w=800',
    'finance': 'https://images.unsplash.com/photo-1611974714024-462cd9dc1a95?auto=format&fit=crop&q=80&w=800',
    'crypto': 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=800',
    'entertainment': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800',
    'movies': 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800',
    'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
    'anime': 'https://images.unsplash.com/photo-1578632738988-6888af5a2462?auto=format&fit=crop&q=80&w=800',
    'sports': 'https://images.unsplash.com/photo-1461896756913-c8b40e725004?auto=format&fit=crop&q=80&w=800',
    'fitness': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800',
    'travel': 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
    'food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
    'news': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=800',
    'politics': 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=800',
    'environment': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800'
  };
  return mapping[normalizedId] || `https://images.unsplash.com/photo-1585829365234-78d2b98ad95f?auto=format&fit=crop&q=80&w=800`;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const { topics, loading: topicsLoading } = useTopics();
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/login'); }
  }, [navigate]);

  const toggleTopic = (id) => {
    if (selectedTopics.includes(id)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== id));
    } else {
      setSelectedTopics([...selectedTopics, id]);
    }
  };

  const handleComplete = async () => {
    if (selectedTopics.length < 3) return;
    setSaving(true);
    try {
      await preferencesService.updateTopics(selectedTopics);
      navigate('/feed');
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  if (topicsLoading) return <div className="min-h-screen bg-[#F4F0EB] flex items-center justify-center font-mono uppercase font-bold tracking-widest">Loading your topic options...</div>;

  return (
    <div className="font-['Inter'] antialiased min-h-screen bg-[#F4F0EB] text-[#111111]">
      {/* STITCH V2 TOP NAVBAR */}
      <header className="bg-[#F4F0EB] border-b-4 border-[#111111] sticky top-0 z-[60] w-full">
        <div className="flex justify-between items-center w-full px-6 py-4">
          <div className="font-['Newsreader'] uppercase tracking-tighter font-black text-2xl italic">
            Choose the topics you want Curate to track
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <div className="border-2 border-[#111111] px-4 py-1 font-mono text-xs uppercase font-bold text-[#FF3300]">Selections update your feed instantly</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-140px)] mb-20">
        {/* SIDEBAR: LIVE PREVIEW */}
        <aside className="w-96 border-r-4 border-[#111111] flex flex-col bg-[#F4F0EB] shrink-0 sticky top-[76px] h-[calc(100vh-156px)]">
          <div className="p-6 border-b-4 border-[#111111]">
            <div className="font-mono text-xs font-bold uppercase text-[#FF3300]">Preview</div>
            <div className="font-mono text-[10px] text-[#111111]/60 uppercase">A preview of what your feed will focus on</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="space-y-4">
              <div className="font-['Newsreader'] italic font-black text-2xl uppercase border-l-4 border-[#FF3300] pl-4">Your upcoming feed</div>
              {selectedTopics.length === 0 ? (
                <div className="font-mono text-[10px] opacity-40">Pick at least 3 topics to personalize your feed.</div>
              ) : (
                selectedTopics.map(id => {
                  const t = topics.find(topic => topic.id === id);
                  return (
                    <div key={id} className="border-b-2 border-[#111111]/10 pb-4 group">
                      <div className="font-mono text-[10px] text-[#FF3300] mb-1">{t?.name?.toUpperCase()} SELECTED</div>
                      <div className="font-['Newsreader'] font-bold text-lg leading-tight italic">Curate will prioritize {t?.name} stories in your feed.</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* TOPIC MATRIX GRID */}
        <section className="flex-1 p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {topics.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              const imageUrl = getTopicImage(topic.id, topic.name);
              return (
                <div 
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`group border-4 border-[#111111] bg-white hover:bg-[#FF3300]/5 transition-colors relative flex flex-col cursor-pointer ${isSelected ? 'ring-4 ring-[#FF3300] ring-offset-4 ring-offset-[#F4F0EB]' : ''}`}
                >
                  <div className="h-40 overflow-hidden border-b-4 border-[#111111] relative">
                    <img 
                      className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110 grayscale-0' : 'grayscale group-hover:grayscale-0'}`} 
                      src={imageUrl} 
                      alt={topic.name} 
                    />
                    {isSelected && <div className="absolute inset-0 bg-[#FF3300]/10" />}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-[10px] font-bold bg-[#111111] text-white px-2 py-0.5">TPC_{topic.id.slice(0,3).toUpperCase()}</span>
                      <div className={`w-6 h-6 border-2 border-[#111111] flex items-center justify-center ${isSelected ? 'bg-[#FF3300]' : 'bg-white'}`}>
                        {isSelected && <span className="text-white font-bold text-xs">✓</span>}
                      </div>
                    </div>
                    <h3 className="font-['Newsreader'] font-black text-xl leading-none uppercase mb-2 italic">{topic.name}</h3>
                    <p className="font-['Inter'] text-xs text-[#111111]/60 leading-tight">{isSelected ? 'Included in your feed profile' : 'Tap to add this topic to your feed'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* FOOTER ACTION BAR */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex justify-between items-center py-4 px-10 bg-[#FF3300] text-white border-t-4 border-[#111111]">
        <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/80">
          Select at least three topics to continue
        </div>
        <div className="flex items-center space-x-12">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] uppercase">Selected Topics:</span>
            <span className="font-mono text-xs font-black">{selectedTopics.length.toString().padStart(2, '0')} / {topics.length}</span>
          </div>
          <button 
            onClick={handleComplete}
            disabled={selectedTopics.length < 3 || saving}
            className="font-['Newsreader'] italic font-black uppercase text-xl hover:bg-black hover:text-[#FF3300] px-8 py-2 transition-all active:invert border-2 border-transparent hover:border-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving selections...' : 'Continue to feed'}
          </button>
        </div>
        <div className="font-mono text-[10px] uppercase underline decoration-2">Your choices can be changed later</div>
      </footer>
    </div>
  );
}

export default OnboardingPage;

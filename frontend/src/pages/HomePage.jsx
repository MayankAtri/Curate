import { AnimatePresence } from 'framer-motion';
import NewsFeed from '../components/NewsFeed';
import TopicFilterBar from '../components/TopicFilterBar';
import ArticleModal from '../components/ArticleModal';
import { useFeed } from '../hooks/useFeed';
import { useTopics } from '../hooks/useTopics';
import { useAnalytics } from '../hooks/useAnalytics';
import { useState } from 'react';

function HomePage() {
  const currentYear = new Date().getFullYear();
  const [activeArticle, setActiveArticle] = useState(null);
  const {
    items, loading, error, selectedTopic, strictTopicFilter, aiSummaryOnly,
    changeTopic, searchTopic, refresh, backToRegularFeed, retry, toggleAiSummaryOnly,
  } = useFeed({ limit: 40 });
  
  const [searchInput, setSearchInput] = useState('');
  const { topics, loading: topicsLoading } = useTopics();
  const { insights } = useAnalytics(30);
  const topTopic = insights?.topEngagedTopics?.[0]?.topic || selectedTopic || 'general';
  const engagedTopicCount = insights?.topEngagedTopics?.length || 0;
  const signalStrength = Math.min(99.9, Math.max(52, 72 + engagedTopicCount * 2.5)).toFixed(1);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchInput.trim();
    if (!query) { changeTopic(null); return; }
    searchTopic(query);
  };

  return (
    <div className="font-['Public_Sans'] antialiased bg-[#fdf9f4] text-[#1c1c19] min-h-screen">
      <main className="pb-40">
        {/* SECTION HEADER */}
        <header className="px-6 py-12 border-b-4 border-black bg-[#f7f3ee]">
          <p className="font-['Space_Grotesk'] text-sm font-bold tracking-widest text-[#b32100] uppercase mb-2">{`Curate / ${currentYear}`}</p>
          <h2 className="font-['Newsreader'] text-6xl font-black tracking-tighter uppercase leading-[0.9] break-words italic">
            {selectedTopic ? `${selectedTopic}` : 'Top stories for you'}
          </h2>
          <div className="mt-6 flex flex-wrap gap-6 text-xs font-['Space_Grotesk'] font-bold uppercase tracking-widest">
            <span>Top topic: {topTopic}</span>
            <span>Topics learned: {engagedTopicCount}</span>
            {selectedTopic && <span>View: {strictTopicFilter ? 'Search results' : 'Topic feed'}</span>}
          </div>
        </header>

        {/* TERMINAL SEARCH (INTEGRATED) */}
        <section className="bg-black text-white p-6 border-b-4 border-black">
          <form className="flex items-center gap-4" onSubmit={handleSearchSubmit}>
            <span className="font-mono text-[#FF3300] font-bold">Search Curate</span>
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search for a topic..." 
              className="flex-1 bg-transparent border-none focus:ring-0 font-mono text-lg text-white"
            />
            <button type="submit" className="bg-[#FF3300] text-white px-6 py-2 font-['Space_Grotesk'] font-bold uppercase text-xs">Search</button>
          </form>
        </section>

        {/* TICKER */}
        <div className="bg-[#fdf9f4] py-3 overflow-hidden border-b-4 border-black flex items-center">
          <div className="flex gap-8 items-center px-4">
            <span className="font-['Space_Grotesk'] text-xs font-bold uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-[#b32100] rounded-full"></span>
              Match level: {signalStrength}%
            </span>
            <span className="font-['Space_Grotesk'] text-xs font-bold uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-[#b32100] rounded-full"></span>
              Articles: {items.length}
            </span>
            <span className="font-['Space_Grotesk'] text-xs font-bold uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-[#b32100] rounded-full"></span>
              Top topic: {topTopic}
            </span>
            <button
              onClick={toggleAiSummaryOnly}
              className={`font-['Space_Grotesk'] text-xs font-bold uppercase underline ${
                aiSummaryOnly ? 'text-[#b32100]' : ''
              }`}
            >
              {aiSummaryOnly ? 'AI summaries only' : 'Show AI summaries only'}
            </button>
            <button onClick={refresh} className="font-['Space_Grotesk'] text-xs font-bold uppercase underline">Refresh feed</button>
            {selectedTopic && (
              <button onClick={backToRegularFeed} className="font-['Space_Grotesk'] text-xs font-bold uppercase underline">
                Back to main feed
              </button>
            )}
          </div>
        </div>

        {/* TOPIC FILTER */}
        {!topicsLoading && (
          <div className="border-b-4 border-black overflow-x-auto whitespace-nowrap px-6 py-4 bg-white">
            <button 
              onClick={() => changeTopic(null)}
              className={`mr-6 font-['Space_Grotesk'] font-bold uppercase text-xs ${!selectedTopic ? 'text-[#b32100] underline decoration-4 underline-offset-8' : ''}`}
            >
              All stories
            </button>
            {topics.map(t => (
              <button 
                key={t.id}
                onClick={() => changeTopic(t.id)}
                className={`mr-6 font-['Space_Grotesk'] font-bold uppercase text-xs ${selectedTopic === t.id ? 'text-[#b32100] underline decoration-4 underline-offset-8' : ''}`}
              >
                #{t.id}
              </button>
            ))}
          </div>
        )}

        {/* LOADING/ERROR STATES */}
        {loading && items.length === 0 && (
          <div className="p-20 text-center font-mono uppercase font-bold text-2xl animate-pulse">Loading stories...</div>
        )}

        {error && (
          <div className="px-6 py-10 border-b-4 border-black bg-[#ffe8e1]">
            <div className="max-w-4xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-widest text-[#b32100] mb-2">Something went wrong</p>
                <p className="font-['Newsreader'] text-2xl font-bold italic">{error}</p>
              </div>
              <button onClick={retry} className="bg-black text-white px-6 py-3 font-['Space_Grotesk'] font-bold uppercase text-xs">
                Retry Fetch
              </button>
            </div>
          </div>
        )}

        {/* THE FEED */}
        <div className="px-6 py-12">
          <NewsFeed
            items={items}
            onArticleClick={setActiveArticle}
            emptyTitle={selectedTopic ? `No dispatches for ${selectedTopic}` : 'No dispatches yet'}
            emptyDescription={
              aiSummaryOnly
                ? selectedTopic
                  ? `No stories with AI summaries are available for ${selectedTopic} yet.`
                  : 'No stories with AI summaries are available yet.'
                : selectedTopic
                  ? `Try another topic or return to the main feed while Curate refreshes this section.`
                  : 'Check back after discovery and summarization finish processing.'
            }
          />
        </div>
      </main>

      <AnimatePresence mode="wait">
        {activeArticle && (
          <ArticleModal article={activeArticle} onClose={() => setActiveArticle(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default HomePage;

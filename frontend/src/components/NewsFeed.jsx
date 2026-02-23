import NewsCard from './NewsCard';

/**
 * NewsFeed Component
 * Displays a grid of news cards in a responsive Bento layout
 */
function NewsFeed({ items, onArticleClick, heroItem, emptyTitle = 'No news yet', emptyDescription = 'Check back later for the latest updates' }) {
  if ((!items || items.length === 0) && !heroItem) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="bento-grid">
      {/* Render Hero Item if provided */}
      {heroItem && (
        <NewsCard
          key={heroItem.article?._id || 'hero'}
          article={heroItem.article || heroItem}
          relevance={heroItem.relevance}
          onClick={onArticleClick}
          variant="hero"
          className="hero-card-container"
        />
      )}

      {/* Render Grid Items */}
      {items.map((item, index) => {
        const article = item.article || item;
        const relevance = item.relevance || null;

        if (!article || !article.title) return null;

        // Determine visual weight based on pattern or relevance
        // e.g., every 5th item spans 2 cols for visual interest
        const isFeatured = index % 5 === 0 || index % 7 === 0;
        const variant = isFeatured ? 'featured' : 'standard';

        return (
          <NewsCard
            key={article._id || article.url || index}
            article={article}
            relevance={relevance}
            onClick={onArticleClick}
            variant={variant}
            className={`grid-item-${index % 12}`} // Cyclical pattern classes
          />
        );
      })}
    </div>
  );
}

export default NewsFeed;

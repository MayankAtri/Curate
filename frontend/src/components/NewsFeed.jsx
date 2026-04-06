import NewsCard from './NewsCard';

function clampScore(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getImportanceScore(article, relevance) {
  const explicitScore = Number(article?.importanceScore);
  if (!Number.isNaN(explicitScore)) {
    return clampScore(explicitScore);
  }

  const relevanceScore = Number(relevance?.score);
  if (!Number.isNaN(relevanceScore)) {
    return clampScore(relevanceScore);
  }

  return 0;
}

export function getCardVariant(article, relevance) {
  const importanceScore = getImportanceScore(article, relevance);

  if (importanceScore >= 0.8) return 'hero';
  if (importanceScore >= 0.5) return 'medium';
  return 'compact';
}

function normalizeFeedItems(items = []) {
  return items
    .map((item, index) => {
      const article = item.article || item;
      const relevance = item.relevance || null;

      if (!article || !article.title) return null;

      return {
        id: article._id || article.url || `item-${index}`,
        article,
        relevance,
        importanceScore: getImportanceScore(article, relevance),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.importanceScore - a.importanceScore);
}

function getLowerGridVariant(item, index) {
  const naturalVariant = getCardVariant(item.article, item.relevance);

  if (naturalVariant === 'hero') {
    return 'medium';
  }

  if (naturalVariant === 'compact' && index % 5 === 0) {
    return 'medium';
  }

  return naturalVariant;
}

function NewsFeed({
  items,
  onArticleClick,
  emptyTitle = 'No news yet',
  emptyDescription = 'Check back later for the latest updates',
}) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  const normalizedItems = normalizeFeedItems(items);
  const heroStory = normalizedItems[0] || null;
  const railStories = normalizedItems.slice(1, 3);
  const remainingStories = normalizedItems.slice(3);

  return (
    <div className="editorial-feed">
      {heroStory && (
        <div className="lead-grid">
          <NewsCard
            key={heroStory.id}
            article={heroStory.article}
            relevance={heroStory.relevance}
            onClick={onArticleClick}
            variant="hero"
            className="lead-hero-card"
          />

          <div className="lead-rail">
            {railStories.map((item) => (
              <NewsCard
                key={item.id}
                article={item.article}
                relevance={item.relevance}
                onClick={onArticleClick}
                variant="medium"
                className="lead-rail-card"
              />
            ))}
          </div>
        </div>
      )}

      {remainingStories.length > 0 && (
        <div className="story-grid">
          {remainingStories.map((item, index) => (
            <NewsCard
              key={item.id}
              article={item.article}
              relevance={item.relevance}
              onClick={onArticleClick}
              variant={getLowerGridVariant(item, index)}
              className="story-grid-card"
            />
          ))}
        </div>
      )}

      {!heroStory && railStories.length === 0 && (
        <div className="story-grid">
          {normalizedItems.map((item, index) => (
          <NewsCard
            key={item.id}
            article={item.article}
            relevance={item.relevance}
            onClick={onArticleClick}
            variant={getLowerGridVariant(item, index)}
            className="story-grid-card"
          />
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsFeed;

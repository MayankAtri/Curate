/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';

function TopicSelector({ topics = [], selectedTopics = [], onToggle }) {
    if (topics.length === 0) {
        return <div className="loading-spinner" />;
    }

    return (
        <div className="topic-grid">
            {topics.map((topic) => {
                const isSelected = selectedTopics.includes(topic.id);

                return (
                    <motion.button
                        key={topic.id}
                        className={`topic-card ${isSelected ? 'active' : ''}`}
                        onClick={() => onToggle(topic.id)}
                        layout
                    >
                        <span className="topic-icon">{topic.icon || '#'}</span>
                        <span className="topic-name">{topic.name}</span>
                        {isSelected && (
                            <motion.div
                                className="check-badge"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                            >
                                ✓
                            </motion.div>
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}

export default TopicSelector;

import { Outlet, useLocation } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import Header from './Header';

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

function Layout() {
    const location = useLocation();

    // Hide default header on Landing Page
    const showHeader = location.pathname !== '/';

    return (
        <div className="app">
            {showHeader && <Header />}
            <motion.div
                key={location.pathname}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pageVariants}
                style={{ width: '100%' }} // Ensure it takes full width
            >
                <Outlet />
            </motion.div>
        </div>
    );
}

export default Layout;

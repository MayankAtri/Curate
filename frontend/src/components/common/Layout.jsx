import { Outlet, useLocation } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import Header from './Header';

const pageVariants = {
    initial: { opacity: 0, y: 14, scale: 0.995, filter: 'blur(4px)' },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    },
    exit: {
        opacity: 0,
        y: -10,
        scale: 0.995,
        filter: 'blur(3px)',
        transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
    },
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

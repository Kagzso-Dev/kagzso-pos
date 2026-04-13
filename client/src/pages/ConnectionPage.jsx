import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ConnectionPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        // Immediately redirect back to the home dashboard as requested to hide this UI.
        const role = user?.role;
        if (role === 'admin') navigate('/admin', { replace: true });
        else if (role === 'kitchen') navigate('/kitchen', { replace: true });
        else if (role === 'cashier') navigate('/cashier', { replace: true });
        else if (role === 'waiter') navigate('/waiter', { replace: true });
        else navigate('/', { replace: true });
    }, [navigate, user]);

    return null;
};

export default ConnectionPage;

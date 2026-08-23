import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useDashboardData from '../hooks/useDashboardData';
import WeatherWarnings from '../components/dashboard/WeatherWarnings';
import NewActivitiesBanner from '../components/dashboard/NewActivitiesBanner';
import ZalohaNotificationBanner from '../components/dashboard/ZalohaNotificationBanner';
import ImportantLinks from '../components/dashboard/ImportantLinks';
import MonthlyStatistics from '../components/dashboard/MonthlyStatistics';
import NextShiftCard from '../components/dashboard/NextShiftCard';
import UpcomingActivities from '../components/dashboard/UpcomingActivities';
import MyAbsences from '../components/dashboard/MyAbsences';
import BulletinWidget from '../components/dashboard/BulletinWidget';
import QuizWidget from '../components/dashboard/QuizWidget';

export default function DashboardPage() {
    const navigate = useNavigate();
    const {
        userData,
        allShifts,
        upcomingActivities,
        monthlyStats,
        absences,
        newZalohaShifts,
        newActivities
    } = useDashboardData();

    const [activitiesDismissed, setActivitiesDismissed] = useState(
        sessionStorage.getItem('dismissed_new_activities') === 'true'
    );
    const [shiftsDismissed, setShiftsDismissed] = useState(
        sessionStorage.getItem('dismissed_new_shifts') === 'true'
    );

    const handleDismissActivities = () => {
        sessionStorage.setItem('dismissed_new_activities', 'true');
        setActivitiesDismissed(true);
    };

    const handleDismissShifts = () => {
        sessionStorage.setItem('dismissed_new_shifts', 'true');
        setShiftsDismissed(true);
        navigate('/shifts');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 10) return 'Dobré ráno';
        if (hour < 18) return 'Dobrý den';
        return 'Dobrý večer';
    };

    return (
        <div className="container dashboard-page" style={{ paddingBottom: '5rem' }}>
            {/* Header */}
            <header style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-heading-accent)' }}>
                    {getGreeting()},{' '}
                    <span style={{ color: 'var(--danger)' }}>{userData?.firstName || 'Hasiči'}</span>!
                </h1>
            </header>

            {/* Weather Warnings */}
            <WeatherWarnings />

            {/* New Záloha Notification Banner */}
            {!shiftsDismissed && (
                <ZalohaNotificationBanner
                    newZalohaShifts={newZalohaShifts}
                    onDismiss={handleDismissShifts}
                />
            )}

            {/* New Activities Banner */}
            {!activitiesDismissed && (
                <NewActivitiesBanner
                    newActivities={newActivities}
                    onDismiss={handleDismissActivities}
                />
            )}

            {/* Bulletin Board Widget */}
            <BulletinWidget />

            {/* Quick Links / Important Links */}
            <ImportantLinks />

            {/* Next Shift Section */}
            <NextShiftCard allShifts={allShifts} userData={userData} />

            {/* Unfinished Quizzes Widget */}
            <QuizWidget />

            {/* Upcoming Activities */}
            <UpcomingActivities upcomingActivities={upcomingActivities} />

            {/* Monthly Statistics Cards */}
            <MonthlyStatistics monthlyStats={monthlyStats} />

            {/* My Absences Panel */}
            <MyAbsences absences={absences} />
        </div>
    );
}

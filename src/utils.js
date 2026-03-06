import { differenceInWeeks, setDay, setHours, setMinutes, setSeconds, isBefore } from 'date-fns';

export const TOTAL_JUZ = 30;

// Exporting utility for legacy usage in App.jsx (e.g. for calculating if someone finished this week)
export function getCurrentWeekNumber(currentDate = new Date()) {
    // A simple implementation since we now rely on created_at for rotation logic
    // This just gives a week number of the year for the UI to use
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const pastDaysOfYear = (currentDate - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

// Replaces getAssignedJuzForGroup
// Now it calculates how many Thursday 11 PM deadlines have passed since the user was created.
// This ensures the rotation shifts globally at the exact same time for every single person.
export function getAssignedJuzForUser(userStartJuz, userCreatedAt, currentDate = new Date()) {
    if (!userCreatedAt) return userStartJuz;

    const createdDate = new Date(userCreatedAt);

    // Find the immediate upcoming Thursday 11 PM for when the user signed up
    const anchorDeadline = getNextDeadline(createdDate);

    // Find the immediate upcoming Thursday 11 PM for the current time
    const currentDeadline = getNextDeadline(currentDate);

    // Calculate how many deadline cycles have elapsed between the two
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksPassed = Math.max(0, Math.round((currentDeadline.getTime() - anchorDeadline.getTime()) / msPerWeek));

    // (Start Juz + Weeks Passed - 1) modulo 30, plus 1 to keep it 1-30.
    let rawJuz = (userStartJuz + weeksPassed) % TOTAL_JUZ;
    if (rawJuz === 0) rawJuz = TOTAL_JUZ;

    return rawJuz;
}

// Next deadline is always the *next* Thursday at 11:00 PM
export function getNextDeadline(currentDate = new Date()) {
    // set day to Thursday (day 4)
    let deadline = setDay(currentDate, 4);
    deadline = setHours(deadline, 23);
    deadline = setMinutes(deadline, 0);
    deadline = setSeconds(deadline, 0);

    // If the compiled deadline is in the past for this week, it means it's Friday or Saturday.
    // The next deadline is NEXT Thursday.
    if (isBefore(deadline, currentDate)) {
        deadline = setDay(deadline, 4 + 7); // Next Thursday
    }

    return deadline;
}

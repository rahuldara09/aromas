/**
 * IIM Ahmedabad dorm list for the dropdown selector.
 * Includes student dorms and faculty housing.
 */
export const IIM_AHMEDABAD_DORMS = [
    'Dorm 1', 'Dorm 2', 'Dorm 3', 'Dorm 4', 'Dorm 5',
    'Dorm 6', 'Dorm 7', 'Dorm 8', 'Dorm 9', 'Dorm 10',
    'Dorm 11', 'Dorm 12', 'Dorm 13', 'Dorm 14', 'Dorm 15',
    'Dorm 16', 'Dorm 17', 'Dorm 18', 'Dorm 19', 'Dorm 20',
    'Dorm 21', 'Dorm 22', 'Dorm 23', 'Dorm 24', 'Dorm 25',
    'Dorm 26', 'Dorm 27', 'Dorm 28', 'Dorm 29', 'Dorm 30',
    'Dorm 31', 'Dorm 32', 'Dorm 33', 'Dorm 34', 'Dorm 35',
    'Dorm 36', 'Dorm 37', 'Dorm 38', 'Dorm 39', 'Dorm 40',
    'New Campus Dorms',
    'Faculty Housing',
    'Staff Quarters',
] as const;

export type IIMAhmedabadDorm = (typeof IIM_AHMEDABAD_DORMS)[number];

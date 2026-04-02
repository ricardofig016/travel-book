export interface MarkerVisitFormRow {
  startDate: string;
  endDate: string;
}

export interface MarkerFormState {
  visited: boolean;
  favorite: boolean;
  want: boolean;
  notes: string;
  companionsText: string;
  activitiesText: string;
  visits: MarkerVisitFormRow[];
}

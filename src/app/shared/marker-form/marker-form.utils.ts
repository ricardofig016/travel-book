import { MarkerFormState } from './marker-form.models';

export interface MarkerEditableSnapshot {
  visited: boolean;
  favorite: boolean;
  want: boolean;
  notes: string | null;
  companions: string[];
  activities: string[];
  visits: Array<{
    startDate: string;
    endDate: string;
  }>;
}

export interface MarkerMutationInput {
  visited: boolean;
  favorite: boolean;
  want: boolean;
  notes: string | null;
  companions: string[];
  activities: string[];
  visits: Array<{
    startDate: string;
    endDate: string;
  }>;
}

export function createEmptyMarkerForm(): MarkerFormState {
  return {
    visited: false,
    favorite: false,
    want: false,
    notes: '',
    companionsText: '',
    activitiesText: '',
    visits: [],
  };
}

export function createMarkerFormFromSnapshot(
  snapshot: MarkerEditableSnapshot,
): MarkerFormState {
  return {
    visited: snapshot.visited,
    favorite: snapshot.favorite,
    want: snapshot.want,
    notes: snapshot.notes ?? '',
    companionsText: snapshot.companions.join(', '),
    activitiesText: snapshot.activities.join(', '),
    visits: snapshot.visits.map((visit) => ({
      startDate: visit.startDate,
      endDate: visit.endDate,
    })),
  };
}

export function toMarkerMutationInput(
  form: MarkerFormState,
): MarkerMutationInput {
  return {
    visited: form.visited,
    favorite: form.favorite,
    want: form.want,
    notes: form.notes.trim() ? form.notes.trim() : null,
    companions: parseTextList(form.companionsText),
    activities: parseTextList(form.activitiesText),
    visits: form.visits
      .filter((visit) => visit.startDate && visit.endDate)
      .map((visit) => ({
        startDate: visit.startDate,
        endDate: visit.endDate,
      })),
  };
}

export function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

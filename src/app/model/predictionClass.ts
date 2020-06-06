export interface PredictionClass {
  label: string;
  classIndex: number;
  confidences: {
    [label: string]: number;
  }
}

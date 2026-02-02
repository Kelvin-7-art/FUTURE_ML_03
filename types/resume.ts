export type Tip = { type?: string; tip?: string; explanation?: string };

export type ScoreBlock = {
  score?: number;
  tips?: Tip[];
  matched?: string[];
  missing?: string[];
};

export type Feedback = {
  overallScore?: number;

  ATS?: ScoreBlock;
  content?: ScoreBlock;
  skills?: ScoreBlock;
  structure?: ScoreBlock;
  toneAndStyle?: ScoreBlock;

  tips?: Tip[];

  [key: string]: any;
};

export type ResumeData = {
  id: string;
  resumePath: string;
  imagePath: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  feedback: Feedback | string;
};

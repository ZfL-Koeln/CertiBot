export type CERTMODEL = {
  image: string;
  secondPageImage?: string;
  outputFile: string;
  participants: string;
  nameMargin?: string;
  dialogTitle: string;
  dialogBody?: string;
};

export const CERTIFICATES: Record<string, CERTMODEL> = {
  RANDOM_STRING: {
    image: 'certificates/workshop-01.jpg',
    outputFile: 'workshop-01.pdf',
    participants: '',
    nameMargin: '1280px',
    dialogTitle: 'Bitte geben Sie Ihren Namen ein:'
  },
  e93a7f1b0c42d8e6a9f35c7d12b48f0e: {
    image: 'certificates/workshop-02.jpg',
    outputFile: 'workshop-02.pdf',
    participants: 'participants/example.txt',
    nameMargin: '1100px',
    dialogTitle: 'Teilnahmebescheinigung Beispielworkshop',
    dialogBody: 'Bitte geben Sie hier Ihren Namen ein. Ihre Eingabe wird automatisch mit der Anmeldeliste abgeglichen.'
  }
};

import dataSource from './students.json';
import { Record } from '../interfaces';

export function getStudentsData() {
  const dimensions: string[] = [
    'gender',
    'race/ethnicity',
    'parental level of education',
    'lunch',
    'test preparation course',
  ];
  const measures: string[] = ['math score', 'reading score', 'writing score'];
  (dataSource as Record[]).forEach((record) => {
    dimensions.forEach((dim: string) => {
      if (record[dim] === undefined) record[dim] = null;
      else {
        record[dim] = record[dim].toString();
      }
    });
    measures.forEach((mea) => {
      if (record[mea] === undefined) record[mea] = 0;
      else {
        record[mea] = Number(record[mea]);
      }
    });
  });
  return {
    dataSource,
    dimensions,
    measures,
  };
}

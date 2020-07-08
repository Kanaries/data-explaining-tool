import titanic from './titanic.json';
import { Record } from '../interfaces';

export function getTitanicData() {
  const { dataSource, config } = titanic;
  const { Dimensions: dimensions, Measures: measures } = config;
  (dataSource as Record[]).forEach(record => {
    dimensions.forEach((dim: string) => {
      if (record[dim] === undefined) record[dim] = null;
      else {
        record[dim] = record[dim].toString();
      }
    })
    measures.forEach(mea => {
      if (record[mea] === undefined) record[mea] = 0;
      else {
        record[mea] = Number(record[mea])
      }
    })
  })
  return {
    dataSource,
    dimensions,
    measures,
  };
}

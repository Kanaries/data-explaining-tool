import { Record } from '../interfaces';
import { max } from 'rxjs/operators';

function normalizeRecords(dataSource: Record[], measures: string[]): { normalizedData: Record[], maxMeasures: Record, minMeasures: Record } {
    const maxMeasures: Record = {};
    const minMeasures: Record = {};
    measures.forEach(mea => {
        maxMeasures[mea] = -Infinity;
        minMeasures[mea] = Infinity;
    })
    dataSource.forEach(record => {
        measures.forEach(mea => {
            maxMeasures[mea] = Math.max(record[mea], maxMeasures[mea])
            minMeasures[mea] = Math.min(record[mea], minMeasures[mea])
        })
    })
    const newData: Record[] = [];
    dataSource.forEach(record => {
        const norRecord: Record = { ... record };
        measures.forEach(mea => {
            norRecord[mea] = (norRecord[mea] - minMeasures[mea]) / (maxMeasures[mea] - minMeasures[mea])
        })
        newData.push(norRecord)
    })
    return {
        normalizedData: newData,
        maxMeasures,
        minMeasures
    }
}

export function checkMajorFactor(data: Record[], childrenData: Map<any, Record[]>, dimensions: string[], measures: string[]): { majorKey: string; majorSum: number } {
    const { normalizedData, maxMeasures, minMeasures } = normalizeRecords(data, measures);
    let majorSum = -Infinity;
    let majorKey = '';
    for (let [key, childData] of childrenData) {
        let sum = 0;
        for (let record of normalizedData ) {
            let target = childData.find(childRecord => {
                return dimensions.every(dim => record[dim] === childRecord[dim])
            })
            if (target) {
                measures.forEach(mea => {
                    let targetValue = (typeof target![mea] === 'number' && !isNaN(target![mea])) ? target![mea] : 0;
                    targetValue = (targetValue - minMeasures[mea]) / (maxMeasures[mea] - minMeasures[mea])
                    sum += (record[mea] - targetValue)
                })
            }
        }
        if (sum > majorSum) {
            majorSum = sum;
            majorKey = key;
        }
    }
    return { majorKey, majorSum };
}
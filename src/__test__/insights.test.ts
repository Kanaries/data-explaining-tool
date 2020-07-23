import { DataExplainer } from '../insights';
import fs from 'fs';
import path from 'path';
const testData = [
    {
        name: 'Alice',
        height: 160,
        gender: 'female',
        age: 18
    },
    {
        name: 'Bob',
        height: 178,
        gender: 'male',
        age: 17
    },
    {
        name: 'Carl',
        height: 181,
        gender: 'male',
        age: 18
    },
    {
        name: 'Duke',
        height: 170,
        gender: 'female',
        age: 18
    },
    {
        name: 'Elisa',
        height: 168,
        gender: 'female',
        age: 17
    },
    {
        name: 'Elisa2',
        height: 184,
        gender: 'male',
        age: 17
    },
    {
        name: 'Frank',
        height: 185,
        gender: 'male',
        age: 18
    },
]

function dropNull (dataSource: any[], dimensions: string[]): any[] {
    return dataSource.filter(record => {
        return dimensions.every(dim => {
            return record[dim] !== null && record[dim] !== '' && record[dim] !== undefined
        })
    })
}
test('explainByChildren', () => {
    const de = new DataExplainer(testData);
    de.setDimensions(['name', 'gender', 'age'])
        .setMeasures(['height'])
        .preAnalysis();
    // const ans = de.explainByMajorFactor([{ age: 18 }], ['age'], ['height'], 2);
    const { majorList, outlierList } = de.explainByChildren(
      [{ age: '18' }, { age: '17' }],
      ['age'],
      ['height'],
      2
    );
    console.log(majorList, outlierList);
    expect(majorList.length > 0).toBe(true);
    expect(outlierList.length > 0).toBe(true);
})

test('explainBySelection', () => {
    const de = new DataExplainer(testData);
    de.setDimensions(['name', 'gender', 'age']).setMeasures(['height']).preAnalysis();
    // const ans = de.explainByMajorFactor([{ age: 18 }], ['age'], ['height'], 2);
    const outlierList = de.explainBySelection(
        [{ age: '18' }],
        ['age'],
        ['height'],
        2
    );
    console.log(outlierList);
    expect(outlierList.length > 0).toBe(true);
});

// test('explainByCorMeasures', () => {
//     const de = new DataExplainer(testData);
//     de.setDimensions(['name', 'gender', 'age'])
//         .setMeasures(['height'])
//         .preAnalysis();
//     // const ans = de.explainByMajorFactor([{ age: 18 }], ['age'], ['height'], 2);
//     const outlierList = de.explainByCorMeasures([{ age: '18' }], ['age'], ['height'], 2);
//     console.log(outlierList);
//     expect(outlierList.length > 0).toBe(true);
// });
// Days to Ship Actual	Sales Forecast	Ship Status	Days to Ship Scheduled	Sales per Customer	Profit Ratio	Category	City	Customer Name	Discount	Order Date	Person	Postal Code	Product Name	Profit	Quantity	Region	Returned	Profit per Order	Sales	Segment	Ship Date	Ship Mode	State	Sub-Category
test('harder case', () => {
    const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/titanic.json')).toString())
    const dimensions = data.config.Dimensions.filter(
        (f: string) => !['Name', 'PassengerId', 'Ticket'].includes(f)
    );
    const measures = data.config.Measures;
    const dataSource = dropNull(data.dataSource, data.config.Dimensions);
    const de = new DataExplainer(dataSource);
    de.setDimensions(dimensions)
        .setMeasures(measures)
        .preAnalysis();
    const ans = de.explainBySelection([
        {
            "Pclass": "3",
        }
    ], ['Pclass'], ['Survived'], 10)
    console.log(ans)
    expect(ans.length > 0).toBe(true);
    const { majorList, outlierList } = de.explainByChildren([{ Pclass: '1'}, { Pclass: '2'}, { Pclass: '3'}],
    ['Pclass'], ['Survived'], 10)
    console.log({
        majorList,
        outlierList
    })
    // expect(ans.majorList.length > 0).toBe(true);
    // expect(ans.outlierList.length > 0).toBe(true);
})
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Record, Field, SemanticType, Filters } from '../interfaces';
import { Insight, Utils, UnivariateSummary, specification } from 'visual-insights';
import { Specification } from 'visual-insights/build/esm/commonTypes';
import { baseVis } from './std2vegaSpec';
import embed from 'vega-embed';
import aggregate from 'cube-core';
import { getInsightSpaces } from '../services';
import { Spinner } from '@tableau/tableau-ui';
import RadioGroupButtons from './radioGroupButtons';
import { field } from 'vega';
import { DataExplainer } from '../insights';
import { getPredicatesFromVegaSignals } from '../utils';

const collection  = Insight.IntentionWorkerCollection.init();
type IReasonType = 'selection_dim_distribution' | 'selection_mea_distribution' | 'children_major_factor' | 'children_outlier';
// const InsightTypeMapper: { [key: string]: string } = {
//   [Insight.DefaultIWorker.cluster]: '分组区分度',
//   [Insight.DefaultIWorker.outlier]: '异常',
//   [Insight.DefaultIWorker.trend]: '趋势'
//   // []: ''
// }

const ReasonTypeNames: { [key: string]: string} = {
  'selection_dim_distribution': '选择集+新维度',
  'selection_mea_distribution': '选择集+新度量',
  'children_major_factor': '子节点主因',
  'children_outlier': '子节点异常'
}
collection.enable(Insight.DefaultIWorker.cluster, false);
interface SubSpace {
  dimensions: string[];
  measures: string[];
}
function containSpace (space1: SubSpace, space2: SubSpace): boolean {
  if (space1.dimensions.length <= space2.dimensions.length && space1.measures.length <= space2.measures.length) return false;
  let m = true;
  let d = true
  for (let dimInSpace2 of space2.dimensions) {
    if (!space1.dimensions.includes(dimInSpace2)) {
      d = false;
      break;
    }
  }
  for (let meaInSpace2 of space2.measures) {
    if (!space1.measures.includes(meaInSpace2)) {
      m = false;
      break;
    }
  }
  return d || m;
}

function shareSpace(space1: SubSpace, space2: SubSpace): boolean {

  for (let dimInSpace2 of space2.dimensions) {
    if (space1.dimensions.includes(dimInSpace2)) {
      return true;
    }
  }
  for (let meaInSpace2 of space2.measures) {
    if (space1.measures.includes(meaInSpace2)) {
      return true;
    }
  }
  return false;
}

function spec(dataSource: Record[], dimensions: string[], measures: string[], fieldTypes: Array<{type: SemanticType; name: string}>) {
  const fieldEntropyList = UnivariateSummary.getAllFieldsEntropy(
    dataSource,
    dimensions.concat(measures)
  );
  const dimScores = fieldEntropyList.map((f) => {
    return [
      f.fieldName,
      f.entropy,
      f.maxEntropy,
      fieldTypes.find(f_ => f_.name === f.fieldName)
    ];
  }) as any;
  return specification(
    dimScores,
    dataSource,
    dimensions,
    measures
  )
}

function applyFilters (dataSource: Record[], filters: Filters): Record[] {
  let filterKeys = Object.keys(filters);
  return dataSource.filter(record => {
    let keep = true;
    for (let filterKey of filterKeys) {
      if (filters[filterKey].length > 0) {
        if (!filters[filterKey].includes(record[filterKey])) {
          keep = false;
          break;
        }
      }
    }
    return keep;
  })
}
interface InsightBoardProps {
  dataSource: Record[];
  fields: Field[];
  filters?: Filters;
  viewDs: Field[];
  viewMs: Field[];
}
const InsightBoard: React.FC<InsightBoardProps> = props => {
  const { dataSource, fields, viewDs, viewMs, filters } = props;
  const [recSpaces, setRecSpaces] = useState<Insight.InsightSpace[]>([]);
  const [visIndex, setVisIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const container = useRef<HTMLDivElement>(null);
  const dimsWithTypes = useMemo(() => {
    const dimensions = fields
      .filter((f) => f.type === 'D')
      .map((f) => f.id)
      .filter((f) => !Utils.isFieldUnique(dataSource, f));
    return UnivariateSummary.getAllFieldTypes(dataSource, dimensions);
  }, [fields, dataSource])
  const measWithTypes = useMemo(() => {
    const measures = fields.filter((f) => f.type === 'M').map((f) => f.id);
    return measures.map((m) => ({
      name: m,
      type: 'quantitative',
    }));
  }, [fields]);

  const cookedInfo = useMemo(() => {
    // TODO: fix auto group
    // const filteredData = filters ? applyFilters(dataSource, filters) : dataSource;
    const filteredData = dataSource;
    // console.log('filtered data', filters, filteredData)
    const groupedData = UnivariateSummary.groupFields(filteredData, dimsWithTypes);
    const cookedDimensions: Array<{ name: string; type: SemanticType }> = [];
    for (let field of groupedData.fields) {
      let target = groupedData.newFields.find(
        (f) => f.name.slice(0, -7) === field.name
      );
      // cookedDimensions.push({
      //   name: target ? target.name : field.name,
      //   type: target ? target.type : field.type,
      // });
      cookedDimensions.push({
          name: field.name,
          type: field.type,
      });
    }
    // return {
    //   cookedDataSource: groupedData.groupedData,
    //   cookedDimensions: cookedDimensions
    // }
    return {
        cookedDataSource: dataSource,
        cookedDimensions: cookedDimensions,
    };
  }, [dataSource, dimsWithTypes])
  useEffect(() => {
    const { cookedDimensions, cookedDataSource } = cookedInfo;
    const measures = fields.filter((f) => f.type === 'M').map((f) => f.id);
    if (cookedDimensions.length > 0 && measures.length > 0 && cookedDataSource.length > 0) {
      const currentSpace: SubSpace = {
        dimensions: viewDs.map(f => f.id),
        measures: viewMs.map(f => f.id)
      }
      const de = new DataExplainer(cookedDataSource);
      de.setDimensions(cookedDimensions.map(d => d.name))
        .setMeasures(measures)
        .preAnalysis();
      const predicates = getPredicatesFromVegaSignals(filters || {}, currentSpace.dimensions, []);
      const ansSpaces: any[] = [];
      const dimSelectionSpaces = de.explainBySelection(predicates, currentSpace.dimensions, currentSpace.measures, 5);
      const meaSelectionSpaces = de.explainByCorMeasures(predicates, currentSpace.dimensions, currentSpace.measures, 5);
      const childrenSpaces = de.explainByChildren([], currentSpace.dimensions, currentSpace.measures, 5);

      dimSelectionSpaces.forEach(space => {
        ansSpaces.push({
            dimensions: [...space.dimensions, ...currentSpace.dimensions],
            measures: currentSpace.measures,
            significance: space.score,
            type: 'selection_dim_distribution',
            description: space,
        });
      })
      meaSelectionSpaces.forEach(space => {
        ansSpaces.push({
            dimensions: currentSpace.dimensions,
            measures: space.measures,
            significance: space.score,
            type: 'selection_mea_distribution',
            description: space,
        });
      })
      childrenSpaces.majorList.forEach((space) => {
          ansSpaces.push({
              dimensions: [...currentSpace.dimensions, ...space.dimensions],
              measures: currentSpace.measures,
              significance: space.score,
              type: 'children_major_factor',
              description: space,
          });
      });
      childrenSpaces.outlierList.forEach((space) => {
          ansSpaces.push({
              dimensions: [...currentSpace.dimensions, ...space.dimensions],
              measures: currentSpace.measures,
              significance: space.score,
              type: 'children_outlier',
              description: space,
          });
      });
      setRecSpaces(ansSpaces);
      // setLoading(true)
      // getInsightSpaces({
      // // Insight.getVisSpaces({
      //   dimensions: cookedDimensions.map(d => d.name),
      //   measures,
      //   dataSource: cookedDataSource,
        
      //   max_dimension_num_in_view: viewDs.length + 2,
      //   max_measure_num_in_view: viewMs.length + 1
      // }).then(spaces => {
      //   // console.log('ans len', spaces.length)
      //   const relativeSpaces = spaces
      //     .filter(space => space.significance > 0.4)
      //     .filter(space => {
      //       return containSpace(space, currentSpace);
      //     })
      //     .map(space => ({
      //       ...space,
      //       score: space.impurity! / space.significance
      //     }))
      //     .sort((a, b) => (a.score || 0) - (b.score || 0))
      //     .slice(0, 5)
      //   setRecSpaces(relativeSpaces)
      //   setLoading(false)
      // })
    }
  }, [fields, viewDs, viewMs, cookedInfo, measWithTypes, filters])

  const fieldsWithType = useMemo(() => {
    return [...cookedInfo.cookedDimensions, ...measWithTypes];
  }, [cookedInfo.cookedDimensions, measWithTypes])

  useEffect(() => {
    const RecSpace = recSpaces[visIndex];
    if (container.current && RecSpace) {
      const aggData = aggregate({
        dimensions: RecSpace.dimensions,
        measures: RecSpace.measures,
        dataSource: cookedInfo.cookedDataSource,
        asFields: RecSpace.measures,
        operator: 'sum',
      });
      const result = spec(
        aggData,
        RecSpace.dimensions,
        RecSpace.measures,
        fieldsWithType as any
      );
      const _vegaSpec = baseVis(
        result.schema,
        result.schema.geomType && result.schema.geomType[0] === 'point' ? cookedInfo.cookedDataSource : result.aggData,
        // result.aggData,
        RecSpace.dimensions,
        RecSpace.measures,
        RecSpace.measures.map((m) => ({
          op: 'sum',
          field: m,
          as: m,
        })),
        fieldsWithType as any,
        true,
        true
      );
      if (container.current) {
        console.log(_vegaSpec)
        embed(container.current, _vegaSpec);
      }
    }
  }, [visIndex, recSpaces, fieldsWithType, cookedInfo])

  const FilterDesc = useMemo<string>(() => {
    if (filters) {
      const values = Object.keys(filters)
      .filter(k => filters[k].length > 0)
        .map((k) => {
          return `${k}=${filters[k]}`;
        });
      return `取值为${values.join(', ')}的数据还可能有以下洞察!`; 
    }
    return ''
  }, [filters])

  return (
    <div style={{ maxHeight: '720px', minHeight: '200px', overflowY: 'auto', maxWidth: '880px' }}>
      <p>{FilterDesc}</p>
      {loading && (
        <div aria-busy style={{ display: 'inline-block' }}>
          <Spinner />
        </div>
      )}
      <div style={{ display: 'flex' }}>
        <div style={{ flexBasis: '200px', flexShrink: 0 }}>
          <RadioGroupButtons
            choosenIndex={visIndex}
            options={recSpaces.map((s, i) => ({
              value: s.type || '' + i,
              label: `${s.type ? ReasonTypeNames[s.type] : '未识别'}: ${Math.round(s.significance * 100)}%`,
            }))}
            onChange={(v, i) => {
              setVisIndex(i);
            }}
          />
        </div>
        <div>
          <div ref={container}></div>
          {recSpaces[visIndex] && (
            <p>
              维度是{recSpaces[visIndex].dimensions.join(', ')}。<br />
              度量是{recSpaces[visIndex].measures.join(', ')}。<br />
              此时具有
              {recSpaces[visIndex].type
                ? ReasonTypeNames[recSpaces[visIndex].type!]
                : '未识别'}{' '}
              ，显著性为{Math.round(recSpaces[visIndex].significance * 100)}%。
              <br />
              {recSpaces[visIndex].description &&
                `详情：${JSON.stringify(
                  recSpaces[visIndex].description,
                  null,
                  2
                )}。`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsightBoard;

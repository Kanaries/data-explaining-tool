
import { Specification } from 'visual-insights/build/esm/commonTypes';
import { Record, SemanticType } from '../interfaces';
import { deepcopy } from 'visual-insights/build/esm/utils';
import { IPredicate } from '../utils';
export const geomTypeMap: { [key: string]: any } = {
  interval: 'bar',
  line: 'line',
  point: 'point',
  // density: 'rect'
  density: 'point',
};
export function baseVis(
  query: Specification,
  dataSource: Record[],
  dimensions: string[],
  measures: string[],
  predicates: IPredicate[],
  aggregatedMeasures: Array<{ op: string; field: string; as: string }>,
  fieldFeatures: Array<{name: string; type: SemanticType}>,
  defaultAggregated?: boolean,
  defaultStack?: boolean
) {
  const {
    position = [],
    color = [],
    size = [],
    facets = [],
    opacity = [],
    geomType = [],
    page = [],
  } = query;

  function adjustField(fieldName: string): string {
    if (defaultAggregated && measures.includes(fieldName)) {
      let aggField = aggregatedMeasures.find((mea) => {
        return mea.field === fieldName;
      });
      return aggField ? aggField.as : fieldName;
    }
    return fieldName;
  }

  function getFieldType(field: string): SemanticType {
    let targetField = fieldFeatures.find((f) => f.name === field);
    return targetField ? targetField.type : 'nominal';
  }

  let chartWidth = 500; //container.current ? container.current.offsetWidth * 0.8 : 600;
  const fieldMap: any = {
    x: position[0],
    y: position[1],
    color: color[0],
    size: size[0],
    opacity: opacity[0],
    row: facets[0],
    column: facets[1],
  };
  let spec: any = {
    width: chartWidth,
    data: {
      values: dataSource,
    },
    transform: []
  };
  let basicSpec: any = {
    width: chartWidth,
    mark: {
      type:
        geomType[0] && geomTypeMap[geomType[0]]
          ? geomTypeMap[geomType[0]]
          : geomType[0],
      tooltip: true,
    },
    encoding: {},
  };
  for (let channel in fieldMap) {
    if (fieldMap[channel]) {
      basicSpec.encoding[channel] = {
        field: adjustField(fieldMap[channel]),
        type: getFieldType(fieldMap[channel]),
      };
      if (getFieldType(fieldMap[channel]) === 'quantitative' && defaultAggregated) {
        basicSpec.encoding[channel].aggregate = 'sum';
      }
      if (
        ['x', 'y'].includes(channel) &&
        getFieldType(fieldMap[channel]) === 'quantitative' &&
        !defaultStack
      ) {
        basicSpec.encoding[channel].stack = null;
      }
    }
  }
  if (!defaultStack && opacity.length === 0) {
    basicSpec.encoding.opacity = { value: 0.7 };
  }
  const basicSpecFilter = deepcopy(basicSpec);
  basicSpec.mark.opacity = 0.9;
  basicSpec.mark.color = '#8c8c8c';
  // basicSpecFilter.mark.color = '#f5222d';
  basicSpecFilter.mark.opacity = 0.9;
  basicSpecFilter.transform = predicates.map(pre => {
    const filter: any = {
      filter: {
        field: pre.key,
      }
    };
    if (pre.type === 'continuous') {
      filter.filter.range = pre.range
    } else {
      filter.filter.oneOf = [...pre.range.values()]
    }
    return filter
  })
  if (dimensions.length > 2 || measures.length >= 2) {
    spec = {
        ...spec,
        vconcat: [basicSpec, basicSpecFilter],
    };
  } else {
    spec = {
        ...spec,
        layer: [basicSpec, basicSpecFilter],
    };
  }
  return spec;
}

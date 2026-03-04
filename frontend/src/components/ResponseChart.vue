<template>
  <div ref="chartRef" class="chart-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  data: {
    times: string[];
    series: { name: string; data: number[] }[];
  };
}>();

const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const initChart = () => {
  if (!chartRef.value) return;
  
  chartInstance = echarts.init(chartRef.value);
  updateChart();
  
  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  chartInstance?.resize();
};

const updateChart = () => {
  if (!chartInstance) return;

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: props.data.series.map(s => s.name),
      type: 'scroll',
      bottom: 0,
      left: 'center',
      width: '90%',
      pageButtonItemGap: 5,
      pageButtonGap: 10,
      pageIconSize: 12,
      pageTextStyle: {
        color: '#666'
      },
      textStyle: {
        fontSize: 11
      },
      itemWidth: 15,
      itemHeight: 10,
      itemGap: 8
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.data.times
    },
    yAxis: {
      type: 'value',
      name: 'ms'
    },
    series: props.data.series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      data: s.data,
      showSymbol: false
    }))
  };

  chartInstance.setOption(option);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

onMounted(() => {
  initChart();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
});
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 300px;
}
</style>

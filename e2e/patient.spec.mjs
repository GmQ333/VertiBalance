import { expect, test } from '@playwright/test';

async function loginAsPatient(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '进入患者端' }).click();
  await expect(page.getByRole('heading', { name: /你好，/ })).toBeVisible();
}

async function openPatientPage(page, projectName, navigationLabel) {
  if (projectName === 'mobile-edge') await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: navigationLabel, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await loginAsPatient(page);
});

test('患者核心页面可以从导航访问', async ({ page }, testInfo) => {
  const pages = [
    ['问诊记录', '问诊记录'],
    ['我的挂号', '我的挂号'],
    ['康复随访', '康复随访'],
    ['健康资料', '健康资料'],
    ['健康科普', '眩晕健康科普'],
  ];

  for (const [navigationLabel, heading] of pages) {
    await openPatientPage(page, testInfo.project.name, navigationLabel);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

test('智能问诊显示服务状态与输入控件', async ({ page }, testInfo) => {
  await openPatientPage(page, testInfo.project.name, '智能问诊');
  await expect(page.getByText('规则筛查已启用，模型服务未配置')).toBeVisible();
  await expect(page.getByPlaceholder('请描述你的感受…')).toBeVisible();
  await expect(page.getByRole('button', { name: '结束并生成报告' })).toBeDisabled();
});

test('患者可以提交人工帮助请求并查看状态', async ({ page }, testInfo) => {
  await openPatientPage(page, testInfo.project.name, '智能问诊');
  await page.getByRole('button', { name: '人工帮助' }).click();
  await expect(page.getByRole('dialog', { name: '联系平台健康顾问' })).toBeVisible();
  await page.getByLabel('联系电话或其他联系方式').fill('13800138000');
  await page.getByLabel('问题摘要').fill('希望健康顾问协助说明后续问诊流程');
  await page.getByRole('button', { name: '提交联系请求' }).click();
  await expect(page.getByText('帮助请求已提交，平台人员将按顺序联系你。')).toBeVisible();
  await expect(page.getByText('待受理')).toBeVisible();
});

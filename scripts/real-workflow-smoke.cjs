const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const appId = process.env.PISCES_REAL_WORKFLOW_APP_ID || 'shop-app';
const webBaseUrl = (process.env.PISCES_WEB_BASE_URL || 'http://127.0.0.1:3039').replace(/\/$/, '');
const apiBaseUrl = (process.env.PISCES_API_BASE_URL || 'http://127.0.0.1:9990/api').replace(/\/$/, '');
const outputFile = path.resolve(
  process.env.PISCES_REAL_WORKFLOW_OUTPUT_FILE
    || 'target/pisces-real-browser-workflow-smoke/summary.json',
);
const screenshotDir = path.resolve(
  process.env.PISCES_REAL_WORKFLOW_SCREENSHOT_DIR
    || path.join(path.dirname(outputFile), 'screenshots'),
);

const resolveKeyForScope = (requiredScope) => {
  const directKeys = {
    management: process.env.PISCES_MANAGEMENT_API_KEY,
    admin: process.env.PISCES_ADMIN_API_KEY,
  };
  if (directKeys[requiredScope]) return directKeys[requiredScope];

  const specs = String(process.env.PISCES_API_KEY_SPECS || '').split(',');
  for (const rawSpec of specs) {
    const parts = rawSpec.split('|').map(part => part.trim());
    if (parts.length < 4) continue;
    const scopes = new Set(parts[3].split('+').map(scope => scope.trim().toLowerCase()));
    if (scopes.has(requiredScope) || scopes.has('admin')) return parts[0];
  }
  return '';
};

const managementKey = resolveKeyForScope('management');
const adminKey = resolveKeyForScope('admin');

const unwrap = payload => (
  payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
);

const apiRequest = async (method, requestPath, apiKey, body, allowError = false) => {
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Pisces-Api-Key': apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`${method} ${requestPath} 返回了非 JSON 内容`);
    }
  }
  const businessCode = Number(payload?.code ?? response.status);
  const successful = response.ok && businessCode < 400;
  if (!successful && !allowError) {
    throw new Error(`${method} ${requestPath} 失败：${payload?.message || response.status}`);
  }
  return { response, payload, data: unwrap(payload), successful };
};

const getApplicationExperiments = async () => {
  const result = await apiRequest(
    'GET',
    `/experiments?appId=${encodeURIComponent(appId)}`,
    managementKey,
  );
  return Array.isArray(result.data) ? result.data : [];
};

const responseMatches = (response, requestPath, method = 'POST') => {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === `/api${requestPath}`;
};

const writeSummary = (summary) => {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
};

const run = async () => {
  if (!managementKey) {
    throw new Error('缺少 management 或 admin 权限的 Pisces API Key');
  }

  fs.mkdirSync(screenshotDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const steps = [];
  const runtimeErrors = [];
  const dialogs = [];
  const experimentName = `浏览器真实闭环-${Date.now()}`;
  let browser;
  let page;
  let experimentId = '';
  let initialExperimentCount = null;
  let finalExperimentCount = null;
  let cleanupSucceeded = false;
  let failure = null;

  const record = (name, details = {}) => {
    steps.push({ name, status: 'PASS', ...details });
  };

  try {
    const applicationsResult = await apiRequest('GET', '/applications', managementKey);
    const applications = Array.isArray(applicationsResult.data) ? applicationsResult.data : [];
    const application = applications.find(item => item.appId === appId);
    if (!application) throw new Error(`当前管理身份无法访问应用 ${appId}`);
    initialExperimentCount = (await getApplicationExperiments()).length;
    record('应用和原始数据可访问', {
      appId,
      applicationName: application.displayName || appId,
      initialExperimentCount,
    });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => runtimeErrors.push(`页面脚本错误：${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`控制台错误：${message.text()}`);
    });
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });
    await page.route('**/api/**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'x-pisces-api-key': managementKey,
        },
      });
    });

    await page.goto(`${webBaseUrl}/variants-lab`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '生成完整实验方案' }).waitFor();
    const appSelect = page.locator('select').first();
    await appSelect.selectOption(appId);
    await page.getByRole('button', { name: '实验设计' }).click();
    const primaryMetricSelect = page.locator('select').first();
    await primaryMetricSelect.waitFor();
    await page.waitForFunction(() => {
      const selects = [...document.querySelectorAll('select')];
      const metricSelect = selects.find(select => [...select.options].some(option => option.value && option.textContent));
      return Boolean(metricSelect && metricSelect.options.length > 1);
    });
    const generateButton = page.getByRole('button', { name: '生成完整方案', exact: true });
    await generateButton.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')]
        .find(item => item.textContent?.trim() === '生成完整方案');
      return Boolean(button && !button.disabled);
    });
    const generateResponsePromise = page.waitForResponse(
      response => responseMatches(response, '/variants/generate'),
      { timeout: 300000 },
    );
    await generateButton.click();
    const generateResponse = await generateResponsePromise;
    if (!generateResponse.ok()) throw new Error(`真实方案生成失败：HTTP ${generateResponse.status()}`);
    const applyAllPlansButton = page.getByRole('button', { name: /全部 \d+ 个方案用于新实验/ });
    await applyAllPlansButton.waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(screenshotDir, '01-real-ai-plans.png'), fullPage: true });
    record('页面调用真实千问生成完整方案');

    await applyAllPlansButton.click();
    await page.waitForURL(url => url.pathname === '/ai-design');
    await page.getByText(/已导入方案“全部 \d+ 个候选方案”/).waitFor();
    await page.getByPlaceholder('例如：二手手机标题实验').fill(experimentName);
    const preflightResponsePromise = page.waitForResponse(
      response => responseMatches(response, '/experiments/preflight'),
    );
    await page.getByRole('button', { name: '创建前检查', exact: true }).click();
    const preflightResponse = await preflightResponsePromise;
    if (!preflightResponse.ok()) throw new Error(`创建前检查失败：HTTP ${preflightResponse.status()}`);
    const preflightPayload = unwrap(await preflightResponse.json()) || {};
    await page.screenshot({ path: path.join(screenshotDir, '02-real-preflight.png'), fullPage: true });
    if (!preflightPayload.readyToCreate) {
      const blockers = (preflightPayload.checks || [])
        .filter(check => check.status === 'BLOCKED' || check.status === 'BLOCK')
        .map(check => `${check.title || check.code}：${check.detail || check.action || '未提供原因'}`);
      throw new Error(`创建前检查存在阻断项：${blockers.join('；') || '未返回阻断明细'}`);
    }
    await page.getByText('可以创建实验', { exact: true }).waitFor();
    record('页面完成实验草案填充和创建前检查');

    const createResponsePromise = page.waitForResponse(
      response => responseMatches(response, '/experiments'),
    );
    await page.getByRole('button', { name: '确认创建实验', exact: true }).click();
    const createResponse = await createResponsePromise;
    const createPayload = await createResponse.json();
    const createdExperiment = unwrap(createPayload) || {};
    experimentId = createdExperiment.id || createdExperiment.experimentId || '';
    if (!createResponse.ok() || !experimentId) {
      throw new Error(`页面创建实验失败：${createPayload?.message || createResponse.status()}`);
    }
    await page.waitForURL(url => url.pathname === `/experiments/${experimentId}`);
    record('页面创建真实实验', { experimentId });

    if (application.approvalRequired) {
      if (!adminKey) throw new Error('应用要求审批，但本地未配置 admin Key');
      await apiRequest('POST', `/experiments/${experimentId}/approval-status`, adminKey, {
        approvalStatus: 'APPROVED',
        comment: '真实浏览器闭环自动审批',
        operator: 'anran',
      });
      await page.reload({ waitUntil: 'networkidle' });
      record('完成启动审批');
    }

    const startResponsePromise = page.waitForResponse(
      response => responseMatches(response, `/experiments/${experimentId}/start`),
    );
    await page.getByRole('button', { name: '启动', exact: true }).click();
    const startResponse = await startResponsePromise;
    if (!startResponse.ok()) throw new Error(`页面启动实验失败：HTTP ${startResponse.status()}`);
    await page.getByRole('button', { name: '暂停', exact: true }).waitFor();
    record('页面启动真实实验');

    const simulateResponsePromise = page.waitForResponse(
      response => responseMatches(response, `/experiments/generator/${experimentId}/simulate`),
      { timeout: 300000 },
    );
    await page.getByRole('button', { name: '生成实验数据', exact: true }).click();
    const simulateResponse = await simulateResponsePromise;
    if (!simulateResponse.ok()) throw new Error(`页面生成实验数据失败：HTTP ${simulateResponse.status()}`);
    await page.getByRole('link', { name: '查看分析', exact: true }).waitFor();
    record('页面生成并物化真实实验数据');

    await page.getByRole('link', { name: '查看分析', exact: true }).click();
    await page.waitForURL(url => url.pathname === `/experiments/${experimentId}/decision`);
    await page.getByRole('button', { name: /^事实与动作/ }).click();
    await page.getByRole('heading', { name: '事实层摘要' }).waitFor({ timeout: 300000 });
    await page.getByText('已就绪', { exact: true }).first().waitFor({ timeout: 300000 });
    await page.screenshot({ path: path.join(screenshotDir, '03-real-analysis.png'), fullPage: true });
    record('页面读取真实统计和分析结果');

    await page.goto(`${webBaseUrl}/experiments/${experimentId}`, { waitUntil: 'networkidle' });
    const stopResponsePromise = page.waitForResponse(
      response => responseMatches(response, `/experiments/${experimentId}/stop`),
    );
    await page.getByRole('button', { name: '停止', exact: true }).click();
    const stopResponse = await stopResponsePromise;
    if (!stopResponse.ok()) throw new Error(`页面停止实验失败：HTTP ${stopResponse.status()}`);
    record('页面停止真实实验');

    await page.getByRole('button', { name: /^结论/ }).click();
    const snapshotResponsePromise = page.waitForResponse(
      response => responseMatches(response, `/analysis/experiment/${experimentId}/report/snapshots`),
      { timeout: 300000 },
    );
    await page.getByRole('button', { name: '生成快照', exact: true }).click();
    const snapshotResponse = await snapshotResponsePromise;
    if (!snapshotResponse.ok()) throw new Error(`页面生成报告快照失败：HTTP ${snapshotResponse.status()}`);
    await page.getByText('分析就绪', { exact: true }).waitFor({ timeout: 60000 });

    const conclusionSelect = page.locator('label:has-text("更新人工结论状态") + select');
    await conclusionSelect.selectOption('READY_FOR_REVIEW');
    await page.locator('textarea[placeholder*="人工"]').fill('真实浏览器闭环验证完成，提交内部审核。');
    const conclusionResponsePromise = page.waitForResponse(
      response => responseMatches(response, `/experiments/${experimentId}/conclusion-status`),
    );
    await page.getByRole('button', { name: '保存结论状态', exact: true }).click();
    const conclusionResponse = await conclusionResponsePromise;
    if (!conclusionResponse.ok()) throw new Error(`页面提交实验结论失败：HTTP ${conclusionResponse.status()}`);
    await page.getByText('结论状态已保存，证据版本已绑定。', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(screenshotDir, '04-real-conclusion.png'), fullPage: true });
    record('页面生成报告并提交待审核结论');

    if (runtimeErrors.length > 0) {
      throw new Error(`浏览器发现 ${runtimeErrors.length} 个运行时错误`);
    }
  } catch (error) {
    failure = error;
  } finally {
    if (experimentId) {
      await apiRequest('POST', `/experiments/${experimentId}/stop`, managementKey, undefined, true)
        .catch(() => null);
      const cleanupResult = await apiRequest(
        'DELETE',
        `/experiments/${experimentId}`,
        managementKey,
        undefined,
        true,
      ).catch(() => ({ successful: false }));
      cleanupSucceeded = Boolean(cleanupResult.successful);
    }
    try {
      finalExperimentCount = (await getApplicationExperiments()).length;
    } catch (error) {
      if (!failure) failure = error;
    }
    if (browser) await browser.close();

    if (experimentId && !cleanupSucceeded && !failure) {
      failure = new Error(`临时实验 ${experimentId} 清理失败`);
    }
    if (initialExperimentCount !== null
      && finalExperimentCount !== null
      && initialExperimentCount !== finalExperimentCount
      && !failure) {
      failure = new Error(`清理后实验数量不一致：${initialExperimentCount} -> ${finalExperimentCount}`);
    }

    const summary = {
      summaryType: 'pisces-real-browser-workflow-smoke',
      summaryVersion: 1,
      generatedAt: new Date().toISOString(),
      startedAt,
      status: failure ? 'FAIL' : 'PASS',
      appId,
      experimentId: experimentId || null,
      initialExperimentCount,
      finalExperimentCount,
      cleanedUp: cleanupSucceeded,
      runtimeErrorCount: runtimeErrors.length,
      runtimeErrors,
      dialogs: dialogs.map(item => ({ type: item.type, message: item.message })),
      steps,
      screenshots: [
        '01-real-ai-plans.png',
        '02-real-preflight.png',
        '03-real-analysis.png',
        '04-real-conclusion.png',
      ].filter(fileName => fs.existsSync(path.join(screenshotDir, fileName))),
      error: failure?.message || null,
    };
    writeSummary(summary);
  }

  if (failure) throw failure;
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

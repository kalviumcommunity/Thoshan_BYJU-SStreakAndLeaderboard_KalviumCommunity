const prisma = require('../src/config/prisma');
const taskService = require('../src/services/task.service');

async function testDateSpecificTaskCompletions() {
  console.log('--- Testing Date-Specific Task Completions ---');

  try {
    // 1. Get or create test user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: 'test-unit-user',
          email: 'test-unit@byjus.com',
          name: 'Unit Tester'
        }
      });
    }

    console.log(`Using test user: ${user.name} (${user.id})`);

    // Clean any existing completions for this test user
    await prisma.taskCompletion.deleteMany({ where: { userId: user.id } });

    // Ensure a test task exists
    let task = await prisma.task.findFirst({ where: { userId: user.id } });
    if (!task) {
      task = await taskService.createTask(user.id, {
        title: 'Sample Test Task',
        category: 'Core Concept',
        isRecurring: true,
        recurringType: 'daily'
      });
    }

    const taskId = task.id;
    const date1 = '2024-12-08';
    const date2 = '2024-12-09';
    const date3 = '2024-12-10';

    // Step A: Mark task-1 as DONE on Dec 9 ONLY
    console.log('\n1. Marking task-1 as DONE on 2024-12-09...');
    const result1 = await taskService.toggleTaskCompletion(user.id, taskId, date2, true);
    console.log('Result:', result1);

    // Step B: Verify Dec 9 is DONE
    const compDate2 = await taskService.getCompletionsForDate(user.id, date2);
    console.log(`Completions for ${date2}:`, compDate2);
    if (compDate2[taskId] !== true) {
      throw new Error(`Expected ${taskId} on ${date2} to be true, got ${compDate2[taskId]}`);
    }

    // Step C: Verify Dec 8 and Dec 10 are NOT DONE (independent)
    const compDate1 = await taskService.getCompletionsForDate(user.id, date1);
    const compDate3 = await taskService.getCompletionsForDate(user.id, date3);
    console.log(`Completions for ${date1}:`, compDate1);
    console.log(`Completions for ${date3}:`, compDate3);

    if (compDate1[taskId] === true) {
      throw new Error(`Expected ${taskId} on ${date1} to be undefined/false, got ${compDate1[taskId]}`);
    }
    if (compDate3[taskId] === true) {
      throw new Error(`Expected ${taskId} on ${date3} to be undefined/false, got ${compDate3[taskId]}`);
    }
    console.log('✓ Dec 8 and Dec 10 are completely unaffected by Dec 9 completion!');

    // Step D: Mark task-1 as DONE on Dec 8 as well
    console.log('\n2. Marking task-1 as DONE on 2024-12-08...');
    await taskService.toggleTaskCompletion(user.id, taskId, date1, true);

    const compDate1After = await taskService.getCompletionsForDate(user.id, date1);
    console.log(`Completions for ${date1} after toggle:`, compDate1After);
    if (compDate1After[taskId] !== true) {
      throw new Error(`Expected ${taskId} on ${date1} to be true`);
    }

    // Step E: Undo task-1 on Dec 9 (set to false)
    console.log('\n3. Undoing task-1 on 2024-12-09 (setting to false)...');
    await taskService.toggleTaskCompletion(user.id, taskId, date2, false);

    const compDate2AfterUndo = await taskService.getCompletionsForDate(user.id, date2);
    const compDate1AfterUndo = await taskService.getCompletionsForDate(user.id, date1);

    console.log(`Completions for ${date2} after undo:`, compDate2AfterUndo);
    console.log(`Completions for ${date1} after undo:`, compDate1AfterUndo);

    if (compDate2AfterUndo[taskId] !== false) {
      throw new Error(`Expected ${taskId} on ${date2} to be false after undo`);
    }
    if (compDate1AfterUndo[taskId] !== true) {
      throw new Error(`Expected ${taskId} on ${date1} to remain true!`);
    }
    console.log('✓ Undoing on Dec 9 did NOT affect Dec 8 completion!');

    // Step F: Test repeated toggles do not double count points
    console.log('\n4. Testing repeated toggle idempotence...');
    const repeat1 = await taskService.toggleTaskCompletion(user.id, taskId, date1, true);
    console.log('Points awarded on redundant DONE:', repeat1.pointsAwarded);
    if (repeat1.pointsAwarded !== 0) {
      throw new Error('Expected 0 points awarded on redundant completion toggle');
    }
    console.log('✓ No double counting of points!');

    console.log('\n🎉 ALL DATE-SPECIFIC TASK COMPLETION TESTS PASSED!');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDateSpecificTaskCompletions();

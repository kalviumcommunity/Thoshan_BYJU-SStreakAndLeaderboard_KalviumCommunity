const assert = require('assert');
const prisma = require('../src/config/prisma');
const taskService = require('../src/services/task.service');

async function runTaskCrudAndRecurringTests() {
  console.log('--- Starting Task CRUD & Recurring Engine Tests ---');

  try {
    // 1. Get or create test user
    let user = await prisma.user.findFirst({
      where: { firebaseUid: 'test-crud-recurring-user' }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: 'test-crud-recurring-user',
          email: 'test-crud-recurring@byjus.com',
          name: 'CRUD Recurring Tester'
        }
      });
    }

    console.log(`Using test user: ${user.name} (${user.id})`);

    // Clean existing tasks and completions for this test user
    await prisma.taskCompletion.deleteMany({ where: { userId: user.id } });
    await prisma.task.deleteMany({ where: { userId: user.id } });

    // TEST 1: Create a one-time task for 2024-12-09 (Monday)
    console.log('\n1. Creating one-time task for 2024-12-09...');
    const oneTimeTask = await taskService.createTask(user.id, {
      title: 'Physics Lab Experiment',
      description: 'Optics focal length measurement',
      category: 'Assessment',
      time: '2 PM',
      date: '2024-12-09',
      isRecurring: false,
      recurringType: 'none',
    });
    assert.strictEqual(oneTimeTask.title, 'Physics Lab Experiment');
    assert.strictEqual(oneTimeTask.date, '2024-12-09');
    assert.strictEqual(oneTimeTask.isRecurring, false);
    console.log('✓ One-time task created successfully.');

    // TEST 2: Create a daily recurring task
    console.log('\n2. Creating daily recurring task...');
    const dailyTask = await taskService.createTask(user.id, {
      title: 'Daily Mental Math Warmup',
      description: '15 quick calculations',
      category: 'Quiz Practice',
      time: '8 AM',
      isRecurring: true,
      recurringType: 'daily',
    });
    assert.strictEqual(dailyTask.isRecurring, true);
    assert.strictEqual(dailyTask.recurringType, 'daily');
    console.log('✓ Daily recurring task created successfully.');

    // TEST 3: Create a weekdays-only recurring task (Mon-Fri)
    console.log('\n3. Creating weekdays recurring task...');
    const weekdayTask = await taskService.createTask(user.id, {
      title: 'School Homework Review',
      category: 'Daily Task',
      time: '4 PM',
      isRecurring: true,
      recurringType: 'weekdays',
    });
    assert.strictEqual(weekdayTask.recurringType, 'weekdays');
    console.log('✓ Weekday recurring task created successfully.');

    // TEST 4: Create a custom recurring task for Mon, Wed, Fri (1, 3, 5)
    console.log('\n4. Creating custom days recurring task (Mon/Wed/Fri: 1,3,5)...');
    const mwfTask = await taskService.createTask(user.id, {
      title: 'Chemistry Doubt Solving',
      category: 'Core Concept',
      time: '6 PM',
      isRecurring: true,
      recurringType: 'custom',
      recurringDays: '1,3,5',
    });
    assert.strictEqual(mwfTask.recurringDays, '1,3,5');
    console.log('✓ Custom days recurring task created successfully.');

    // TEST 5: Verify tasks scheduled on 2024-12-09 (Monday)
    console.log('\n5. Querying tasks on Monday (2024-12-09)...');
    const mondayTasks = await taskService.getTasksForDate(user.id, '2024-12-09');
    const mondayIds = mondayTasks.map(t => t.id);
    console.log('Active Monday tasks:', mondayTasks.map(t => `${t.title} (${t.time})`));

    assert(mondayIds.includes(oneTimeTask.id), 'Monday must include one-time task');
    assert(mondayIds.includes(dailyTask.id), 'Monday must include daily task');
    assert(mondayIds.includes(weekdayTask.id), 'Monday must include weekday task');
    assert(mondayIds.includes(mwfTask.id), 'Monday must include MWF task (day 1)');
    console.log('✓ Monday schedule correctly includes all 4 tasks.');

    // TEST 6: Verify tasks scheduled on 2024-12-08 (Sunday)
    console.log('\n6. Querying tasks on Sunday (2024-12-08)...');
    const sundayTasks = await taskService.getTasksForDate(user.id, '2024-12-08');
    const sundayIds = sundayTasks.map(t => t.id);
    console.log('Active Sunday tasks:', sundayTasks.map(t => `${t.title} (${t.time})`));

    assert(!sundayIds.includes(oneTimeTask.id), 'Sunday must NOT include Dec 9 one-time task');
    assert(sundayIds.includes(dailyTask.id), 'Sunday must include daily task');
    assert(!sundayIds.includes(weekdayTask.id), 'Sunday must NOT include weekday task');
    assert(!sundayIds.includes(mwfTask.id), 'Sunday must NOT include MWF task (day 0)');
    console.log('✓ Sunday schedule correctly filters out non-matching tasks.');

    // TEST 7: Verify tasks scheduled on 2024-12-10 (Tuesday - weekday but not in MWF)
    console.log('\n7. Querying tasks on Tuesday (2024-12-10)...');
    const tuesdayTasks = await taskService.getTasksForDate(user.id, '2024-12-10');
    const tuesdayIds = tuesdayTasks.map(t => t.id);
    console.log('Active Tuesday tasks:', tuesdayTasks.map(t => `${t.title} (${t.time})`));

    assert(!tuesdayIds.includes(oneTimeTask.id), 'Tuesday must NOT include Dec 9 task');
    assert(tuesdayIds.includes(dailyTask.id), 'Tuesday must include daily task');
    assert(tuesdayIds.includes(weekdayTask.id), 'Tuesday must include weekday task');
    assert(!tuesdayIds.includes(mwfTask.id), 'Tuesday must NOT include MWF task (day 2)');
    console.log('✓ Tuesday schedule correctly filters custom MWF rule.');

    // TEST 8: Test Task Updating (PUT)
    console.log('\n8. Testing task update...');
    const updated = await taskService.updateTask(user.id, oneTimeTask.id, {
      title: 'Advanced Optics Experiment',
      time: '3 PM',
      category: 'Core Concept'
    });
    assert.strictEqual(updated.title, 'Advanced Optics Experiment');
    assert.strictEqual(updated.time, '3 PM');
    assert.strictEqual(updated.category, 'Core Concept');
    console.log('✓ Task updated successfully.');

    // TEST 9: Date-isolated task completion for recurring task
    console.log('\n9. Testing date-isolated completion on recurring task...');
    const toggleMon = await taskService.toggleTaskCompletion(user.id, dailyTask.id, '2024-12-09', true);
    assert.strictEqual(toggleMon.pointsAwarded, 15, 'First completion should award 15 points');

    const mondayCompletions = await taskService.getTasksForDate(user.id, '2024-12-09');
    const dailyOnMon = mondayCompletions.find(t => t.id === dailyTask.id);
    assert.strictEqual(dailyOnMon.status, 'DONE');
    assert.strictEqual(dailyOnMon.completed, true);

    const tuesdayCompletions = await taskService.getTasksForDate(user.id, '2024-12-10');
    const dailyOnTue = tuesdayCompletions.find(t => t.id === dailyTask.id);
    assert.strictEqual(dailyOnTue.status, 'PENDING');
    assert.strictEqual(dailyOnTue.completed, false);
    console.log('✓ Completing daily task on Monday left Tuesday as PENDING.');

    // TEST 10: Test Task Deletion (DELETE)
    console.log('\n10. Testing task deletion...');
    const delResult = await taskService.deleteTask(user.id, oneTimeTask.id);
    assert.strictEqual(delResult.deleted, true);

    const remainingTasks = await taskService.getAllTasks(user.id);
    assert(!remainingTasks.some(t => t.id === oneTimeTask.id), 'Deleted task should not exist');
    console.log('✓ Task deleted successfully.');

    console.log('\n🎉 ALL TASK CRUD & RECURRING ENGINE TESTS PASSED!');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTaskCrudAndRecurringTests();

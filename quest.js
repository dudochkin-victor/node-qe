var util = require('util');

function check_conditions(object, condition) {
	if (object) {
		IDS = [];
		OUT = {};
		switch (condition['cmd']) {
		case 'SELECT': {
			if (!object[condition['param']])
				object[condition['param']] = 0;
			param = object[condition['param']];
			var check = '\'' + object[condition['param']] + '\''
					+ condition['condition'] + '\'' + condition['val'] + '\'';
			util.puts('CONDITION: ' + check);
			if (eval(check))
				return true;
			break;
		}
		case 'TIMESELECT': {
			// обработка времени TIME_SELECT т.е. если (текщее время -
			// параметр ).condition.val
			for (object_id in register) {
				object = register[object_id];
				if (!object[condition['param']])
					object[condition['param']] = 0;
				if (eval(time()
						+ "-"
						+ object[condition['param']].condition['condition'].condition['val']))
					OUT[object_id] = register[object_id];
			}
			if (OUT.length > 0)
				return OUT;
			break;
		}
		case 'ANSWER': {
			// обработка ответов пользователя от тутора и аска
			val = redis.hget("answers:uid:" + uid, condition['param']);
			if ((!(val === NULL))
					&& (parseInt(val) == parseInt(condition['val'])))
				return register;
			break;
		}
			;
		default:
			break;
		}
		return false;
	}
	return false;
};

function exec_instruction(object, instruction) {
	// TODO: выполнение серверных команд
	// сюда попадает контекст регистра
	// соответственно над всеми объектами контекста мы должны произвести
	// действия в зависимости от команды

	if (object) {
		switch (instruction['cmd']) {
		case 'ADD':
			if (!object[instruction['param']])
				object[instruction['param']] = 0;
			object[instruction['param']] += instruction['val'];
			break;
		case 'SUB':
			if (!object[instruction['param']])
				object[instruction['param']] = 0;
			object[instruction['param']] -= instruction['val'];
			break;
		case 'SET':
			if (!object[instruction['param']])
				object[instruction['param']] = 0;
			object[instruction['param']] = instruction['val'];
			break;
		}
	}
	return null;
};

function updatelogic(applogics, context, response) {

};

function recover_register_from_ids(register, context, ids) {
	if (strlen(ids) > 0) {
		regobjects = explode(",", ids);
		for (object_id in regobjects) {
			register[object_id] = context[object_id];
		}
	}
};

function handle(applogics, context, response, server_cmd) {
	messages_send = false;
	var messages = null;
	if (!context) {
		new_registration = true;
		context = {};
	}
	// if (!context.personage)
	// context.personage = {};
	// data = context.personage;
	// var time = new Date().getTime();
	//
	// // дата регистрации
	// if (!data['regtime'])
	// data['regtime'] = time;
	// if (!data['gametime']) {
	// data['gametime'] = 0;
	// } else {
	// difftime = (time - parseInt(data['lastvisit']));
	// if (difftime < 100) {
	// gametime = difftime + parseInt(data['gametime']);
	// data['gamehours'] = parseInt(gametime / 3600);
	// data['gametime'] = parseInt(gametime);
	// }
	// }
	// data['lastvisit'] = time;

	if (!messages)
		messages = [];
	new_registration = false;
	update_my_info = false;

	// if (request)
	// handle_request();

	if (!context.tasks)
		context.tasks = {};
	for (qid in applogics) {
		
		var task = context.tasks[qid];
		if (task)
			continue;
		
		logics = applogics[qid].logics;
		// Find NOT INNED TRIGGERS;
		inned = {};
		for (lid in logics) {
			element = logics[lid];
			// TODO Check for closed
			// if 'next' or 'or' then add to inned
			if (element.next && logics[element.next])
				inned[element.next] = true;
			if (element.or && logics[element.or])
				inned[element.or] = true;
		}
		starters = {};
		for (lid in logics) {
			if (!(lid in inned) && (logics[lid].type == 'TRIGGER'))
				starters[lid] = logics[lid];
		}

		// может быть несколько триггеров которые запустят одну задачу
		for (tid in starters) {
			// conditions = triggers[tid];
			conditions = starters[tid].conditions;
			util.puts('TRIGGER ' + starters[tid].text);
			// при обработке триггеров готовим начальное состояние регистров
			var out = null;
			for (condition_id in conditions) {
				var condition = conditions[condition_id];
				// при первой несработке условия выйти из этого цикла
				if (!context[condition['object']])
					context[condition['object']] = {};
				out = check_conditions(context[condition['object']], condition); // DV
				if (!out)
					break;
			}

			// если условия сработали или их не было то добавляем задачу в
			// user_tasks
			if (!context.tasks[qid]) {
				if (out) {
					context.tasks[qid] = {
						'title' : applogics[qid].text,
						'instruction' : starters[tid].next
					};
					// если один из триггеров сработал то остальные можно
					// пропустить
					break;
				} else {
					util.puts('OR');
					if (starters[tid].or) {
						context.tasks[qid] = {
							'title' : applogics[qid].text,
							'instruction' : starters[tid].or
						};
					}
				}
			} else
				util.puts('ALREADY');
		}
	}

	// instructions
	for ( var idx in context.tasks) {
		var out = true;
		// TODO: если в задачах нет номера инструкции то создать его
		var task = context.tasks[idx];
		if (task.closed)
			continue;
//		if (!task.instruction)
//			task.instruction = 0;
		task:
		do {
			var instruction = applogics[idx].logics[task.instruction];

			if (instruction.type == 'TRIGGER') {
				util.puts('TRIGGER ' + instruction.text);
				if (instruction.conditions) {
					for (condition_id in instruction.conditions) {
						var condition = instruction.conditions[condition_id];
						// при первой несработке условия выйти из этого
						// цикла
						if (!context[condition['object']])
							context[condition['object']] = {};
						out = check_conditions(context[condition['object']],
								condition);
						if (!out) {
							util.puts('HERE: ' + util.inspect(condition));
							if (instruction.or) {
								util.puts('FALSE. NEXT: '
										+ instruction.or);
								task.instruction = instruction.or;
								var newinstruction = applogics[idx].logics[instruction.or];
								instruction = newinstruction;
								break;
							} else
							{
								util.puts('FALSE. WAIT');
								break task;
							}
						} else {
							if (instruction.next) {
								util.puts('TRUE. NEXT: '
										+ instruction.next);
								task.instruction = instruction.next;
							} else {
								util.puts('TRUE: END\n');
								task.closed = true;
								break task;
							}
						}
					}
				} else if (instruction.next) {
					// Если инструкция имеет продолжения
					task.instruction = instruction.next;
				} else {
					// Финальная инструкция - конец ветки, конец квеста
					task.closed = true;
					break task;
				}
			} else if (instruction.type == 'INSTRUCTION') {
				util.puts('INSTRUCTION ' + instruction.text);
				// просто берем с опрделенным ключом массив шагов
				if (instruction.steps) {
					// собрали а теперь исполняем потому что используется
					// одно соединение
					for (step_id in instruction.steps) {
						step = instruction.steps[step_id];
						if (!context[step['object']])
							context[step['object']] = {};
						// выполняем инструкцию шага закрываем его
						out = exec_instruction(context[step['object']], step);// DV

						// ложим в выходящий регистр
						// if (instruction['out'] && out)
						// registers[instruction['out']] = out;
						// выполняем клиентскую част шага
						if (step['client_cmd'] != '')
							response.push({
								'cmd' : step['client_cmd'],
								'params' : step['client_param']
							});
						if (instruction.next) {
							// Если инструкция имеет продолжения
							task.instruction = instruction.next;
						} else {
							// Финальная инструкция - конец ветки, конец квеста
							task.closed = true;
							break task;
						}
					}
				} else if (instruction.next) {
					// Если инструкция имеет продолжения
					task.instruction = instruction.next;
				} else {
					// Финальная инструкция - конец ветки, конец квеста
					task.closed = true;
					break task;
				}
			} else
				util.puts('UNKNOWN TYPE');
		} while (!task.closed)
	}

	// handle_endaction();

	// handle_thread();

	// handle_reglottery();

	// Проверяем новые сообщения
	if (!messages_send) {
		new_messages = [];
		for ( var i = 0; i < messages.length; i++)
			if (messages[i] != NULL)
				new_messages.push(messages[i]);
		messages = new_messages;

		for ( var i = 0; i < messages.length; i++)
			if (messages[i]['is_new'] == 1) {
				response.push({
					'cmd' : "MESSAGES",
					'params' : messages,
				});
				break;
			}
	}

	// handle_update_myinfo();
	return context;
};
exports.handle = handle;

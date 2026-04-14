# 세션 건강 자가 점검 규칙

## 트리거

- 5턴마다 한 번씩 세션 상태 파일(`/tmp/claude-session-*.state`)을 읽어서 경과 시간을 확인한다.
- 새로운 Step을 시작할 때 반드시 확인한다.
- 사용자가 "세션 상태" 또는 "세션 건강"을 언급하면 즉시 확인한다.

## 점검 방법

```bash
PROJECT_HASH=$(echo "${CLAUDE_PROJECT_DIR:-$(pwd)}" | md5sum | cut -d' ' -f1)
cat "/tmp/claude-session-${PROJECT_HASH}.state"
# 출력: START_TIMESTAMP TURN_COUNT
```

## 임계값

- 60분 또는 30턴: 사용자에게 "세션 피로 감지" 알림
- 90분 또는 50턴: 즉시 핸드오프 생성 권고, 새 작업 시작 거부

## 핸드오프 생성

- `.jjokjipge/handoff-session-NNN.md` 작성
- 완료된 작업, 다음 작업, 핵심 문서 위치, 주의사항 포함
- 사용자에게 "새 세션에서 이 파일을 읽고 이어가세요" 안내

## Stop Hook과의 관계

- Stop Hook(`session-monitor.sh`)은 응답 끝에 자동 실행
- 이 규칙은 AI가 **대화 중간에** 능동적으로 확인하는 것
- 둘 다 있어야 빈틈이 없다

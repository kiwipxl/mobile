import {
  ChallengePrompt,
  ChallengeValidation,
  ChallengeValue,
  PrivilegeCredential,
} from 'snjs';

export const findMatchingValueIndex = (
  values: ChallengeValue[],
  type: ChallengeValue['prompt']['validation']
) => {
  return values.findIndex(arrayValue => type === arrayValue.prompt.validation);
};

export const findMatchingPrivilegeValueIndex = (
  values: PrivilegeLockValue[],
  type: PrivilegeCredential
) => {
  return values.findIndex(arrayValue => type === arrayValue.type);
};

export const isInActiveState = (state: AuthenticationValueStateType) =>
  state !== AuthenticationValueStateType.WaitingInput &&
  state !== AuthenticationValueStateType.Success;

export enum AuthenticationValueStateType {
  WaitingTurn = 0,
  WaitingInput = 1,
  Success = 2,
  Fail = 3,
  Pending = 4,
  Locked = 5,
}

type ChallengeValueState = {
  challengeValues: ChallengeValue[];
  challengeValueStates: AuthenticationValueStateType[];
};
type SetChallengeValueState = {
  type: 'setState';
  valueType: ChallengeValue['prompt']['validation'];
  state: AuthenticationValueStateType;
};
type SetChallengeValue = {
  type: 'setValue';
  valueType: ChallengeValue['prompt']['validation'];
  value: ChallengeValue['value'];
};

export type PrivilegeLockValue = {
  type: PrivilegeCredential;
  value: string;
};

type SetPrivilegesValueState = {
  type: 'setState';
  valueType: PrivilegeLockValue['type'];
  state: AuthenticationValueStateType;
};
type SetPrivilegesValue = {
  type: 'setValue';
  valueType: PrivilegeLockValue['type'];
  value: PrivilegeLockValue['value'];
};

type PrivilegeValueState = {
  privilegeValues: PrivilegeLockValue[];
  privilegeValueStates: AuthenticationValueStateType[];
};

type PrivilegesAction = SetPrivilegesValueState | SetPrivilegesValue;
export const privilegesAuthenticationReducer = (
  state: PrivilegeValueState,
  action: PrivilegesAction
): PrivilegeValueState => {
  switch (action.type) {
    case 'setState': {
      const tempArray = state.privilegeValueStates.slice();
      const index = findMatchingPrivilegeValueIndex(
        state.privilegeValues,
        action.valueType
      );
      tempArray[index] = action.state;
      return { ...state, privilegeValueStates: tempArray };
    }
    case 'setValue': {
      const tempArray = state.privilegeValues.slice();
      const index = findMatchingPrivilegeValueIndex(
        state.privilegeValues,
        action.valueType
      );
      tempArray[index] = {
        type: state.privilegeValues[index].type,
        value: action.value,
      };
      return { ...state, privilegeValues: tempArray };
    }
    default:
      return state;
  }
};

type Action = SetChallengeValueState | SetChallengeValue;
export const authenticationReducer = (
  state: ChallengeValueState,
  action: Action
): ChallengeValueState => {
  switch (action.type) {
    case 'setState': {
      const tempArray = state.challengeValueStates.slice();
      const index = findMatchingValueIndex(
        state.challengeValues,
        action.valueType
      );
      tempArray[index] = action.state;
      return { ...state, challengeValueStates: tempArray };
    }
    case 'setValue': {
      const tempArray = state.challengeValues.slice();
      const index = findMatchingValueIndex(
        state.challengeValues,
        action.valueType
      );
      tempArray[index] = {
        prompt: state.challengeValues[index].prompt,
        value: action.value,
      };
      return { ...state, challengeValues: tempArray };
    }
    default:
      return state;
  }
};

const mapPrivilageCredentialToChallengeValidation = (
  credential: PrivilegeCredential
) => {
  switch (credential) {
    case PrivilegeCredential.AccountPassword:
      return ChallengeValidation.AccountPassword;
    case PrivilegeCredential.LocalPasscode:
      return ChallengeValidation.LocalPasscode;
  }
};

export const getTitleForPrivilegeLockStateAndType = (
  privilegeValue: PrivilegeLockValue,
  state: AuthenticationValueStateType
) => {
  const prompt = new ChallengePrompt(
    mapPrivilageCredentialToChallengeValidation(privilegeValue.type)
  );
  return getChallengePromptTitle(prompt, state);
};

export const getLabelForPrivilegeLockStateAndType = (
  privilegeValue: PrivilegeLockValue,
  state: AuthenticationValueStateType
) => {
  const prompt = new ChallengePrompt(
    mapPrivilageCredentialToChallengeValidation(privilegeValue.type)
  );
  getChallengePromptSubtitle(prompt, state);
};

export const getChallengePromptTitle = (
  prompt: ChallengePrompt,
  state: AuthenticationValueStateType
) => {
  const title = prompt.title!;
  switch (state) {
    case AuthenticationValueStateType.WaitingTurn:
      return title.concat(' ', '- Waiting.');
    case AuthenticationValueStateType.Locked:
      return title.concat(' ', '- Locked.');
    default:
      return title;
  }
};

export const getChallengePromptSubtitle = (
  prompt: ChallengePrompt,
  state: AuthenticationValueStateType
) => {
  switch (prompt.validation) {
    case ChallengeValidation.AccountPassword: {
      switch (state) {
        case AuthenticationValueStateType.WaitingTurn:
        case AuthenticationValueStateType.WaitingInput:
          return 'Enter your account password';
        case AuthenticationValueStateType.Pending:
          return 'Verifying keys...';
        case AuthenticationValueStateType.Success:
          return 'Success | Account Password';
        case AuthenticationValueStateType.Fail:
          return 'Invalid account password. Please try again.';
        default:
          return '';
      }
    }
    case ChallengeValidation.LocalPasscode: {
      switch (state) {
        case AuthenticationValueStateType.WaitingTurn:
        case AuthenticationValueStateType.WaitingInput:
          return 'Enter your local passcode';
        case AuthenticationValueStateType.Pending:
          return 'Verifying keys...';
        case AuthenticationValueStateType.Success:
          return 'Success | Local Passcode';
        case AuthenticationValueStateType.Fail:
          return 'Invalid local passcode. Please try again.';
        default:
          return '';
      }
    }
    case ChallengeValidation.Biometric: {
      switch (state) {
        case AuthenticationValueStateType.WaitingTurn:
        case AuthenticationValueStateType.WaitingInput:
          return 'Please use biometrics to unlock.';
        case AuthenticationValueStateType.Pending:
          return 'Waiting for unlock.';
        case AuthenticationValueStateType.Success:
          return 'Success | Biometrics.';
        case AuthenticationValueStateType.Fail:
          return 'Biometrics failed. Tap to try again.';
        case AuthenticationValueStateType.Locked:
          return 'Biometrics locked. Try again in 30 seconds.';
        default:
          return '';
      }
    }
    default:
      return prompt.title;
  }
};
